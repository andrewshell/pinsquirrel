import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { UserStatus } from '@pinsquirrel/domain'
import { REFRESH_ROTATION_GRACE_MS } from '@pinsquirrel/services'
import { app } from './app'
import {
  db,
  oauthClientRepository,
  oauthTokenRepository,
  sessionRepository,
  userRepository,
} from './lib/db'
import { accountService, maintenanceService } from './lib/services'

/**
 * One OAuth connection, end to end, against the real app and a real database.
 *
 * Nothing here is mocked: `app.fetch` runs every middleware the deployed app
 * runs, `lib/services` is the real composition root, and the rows land in the
 * test database `vitest.config.ts` pins `DATABASE_URL` to. What it proves is
 * the thing no unit test can - that the discovery documents, the consent
 * screen, the token endpoint, the two protected resources and the profile
 * page agree with each other about the same grant.
 *
 * It reads like a client: the only paths written out below are `/mcp` (the URL
 * a user pastes into Claude) and `/profile` (a page a person visits). Every
 * other endpoint is taken from the metadata documents, so a document that
 * advertises the wrong path fails the test rather than being quietly ignored.
 *
 * The cases run in order and hand state to each other. Each is a step in one
 * connection, not an independent scenario, which is what makes the sequence
 * worth asserting: a token minted in one step is used two steps later.
 */

const CLIENT_IP = '198.51.100.17'

/** The MCP resource as a user types it into a client. */
const MCP_PATH = '/mcp'

/**
 * The loopback callback Claude Code registers: no port, because it binds an
 * ephemeral one per connection and RFC 8252 7.3 says the port is not part of
 * the match.
 */
const REGISTERED_REDIRECT_URI = 'http://127.0.0.1/callback'
const EPHEMERAL_REDIRECT_URI = 'http://127.0.0.1:53211/callback'

const CLIENT_NAME = 'PinSquirrel end-to-end test client'

interface AuthorizationServerMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint: string
  revocation_endpoint: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  scope: string
}

/** The app is mounted at the request origin, so a document URL is a path. */
function pathOf(url: string): string {
  const parsed = new URL(url)
  return parsed.pathname + parsed.search
}

async function request(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return app.request(path, init, {
    incoming: { socket: { remoteAddress: CLIENT_IP } },
  })
}

/** A request from the signed-in browser: session cookie, and an Origin CSRF accepts. */
function browserRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Cookie', `__session=${sessionToken}`)
  headers.set('Origin', 'http://localhost')
  return request(path, { ...init, headers })
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  }
}

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

/** A PKCE verifier and the S256 challenge it hashes to (RFC 7636 4.2). */
function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  }
}

/** The `resource_metadata` a `WWW-Authenticate` challenge points at. */
function resourceMetadataUrl(challenge: string | null): string {
  const match = /resource_metadata="([^"]+)"/.exec(challenge ?? '')
  if (!match) throw new Error(`No resource_metadata in: ${challenge ?? 'none'}`)
  return match[1]
}

/** The authorization request, as a client assembles it. */
function authorizationQuery(input: {
  challenge: string
  resource: string
  scope: string
  state: string
  redirectUri?: string
}): Record<string, string> {
  return {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: input.redirectUri ?? EPHEMERAL_REDIRECT_URI,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
    scope: input.scope,
    state: input.state,
    resource: input.resource,
  }
}

function expectRedirectedError(
  res: Response,
  query: Record<string, string>,
  error: string
): URL {
  expect(res.status).toBe(302)
  const location = new URL(res.headers.get('Location') ?? 'about:blank')
  expect(`${location.origin}${location.pathname}`).toBe(query.redirect_uri)
  expect(location.searchParams.get('error')).toBe(error)
  expect(location.searchParams.get('state')).toBe(query.state)
  expect(location.searchParams.get('iss')).toBe(metadata.issuer)
  expect(location.searchParams.get('code')).toBeNull()
  return location
}

/** Approve a consent form and read the client's callback out of the redirect. */
async function approve(query: Record<string, string>): Promise<URL> {
  const res = await browserRequest(
    pathOf(metadata.authorization_endpoint),
    form({ ...query, decision: 'approve' })
  )

  expect(res.status).toBe(302)
  return new URL(res.headers.get('Location') ?? '')
}

function exchange(fields: Record<string, string>): Promise<Response> {
  return request(pathOf(metadata.token_endpoint), form(fields))
}

async function authorizeForCode(input: {
  resource: string
  scope?: string
}): Promise<Record<string, string>> {
  const { verifier, challenge } = pkcePair()
  const query = authorizationQuery({
    challenge,
    resource: input.resource,
    scope: input.scope ?? 'pins:read tags:read offline_access',
    state: randomUUID(),
  })

  const callback = await approve(query)
  return {
    grant_type: 'authorization_code',
    code: callback.searchParams.get('code') ?? '',
    redirect_uri: query.redirect_uri,
    client_id: clientId,
    code_verifier: verifier,
  }
}

async function connect(input: {
  resource: string
  scope?: string
}): Promise<TokenResponse> {
  const res = await exchange(await authorizeForCode(input))

  expect(res.status).toBe(200)
  return (await res.json()) as TokenResponse
}

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
}

function mcpRequest(
  token: string,
  body: unknown,
  extra: Record<string, string> = {}
): Promise<Response> {
  return request(MCP_PATH, {
    method: 'POST',
    headers: { ...MCP_HEADERS, Authorization: `Bearer ${token}`, ...extra },
    body: JSON.stringify(body),
  })
}

/**
 * The opening handshake, done once.
 *
 * `/mcp` is stateless: it builds a server and a transport per request and
 * hands out no `mcp-session-id`, so there is no session to carry and every
 * later call stands on its own. The handshake still happens because a real
 * client sends it, and because a server that stopped answering `initialize`
 * would be a broken server.
 */
async function mcpHandshake(token: string): Promise<void> {
  if (mcpInitialized) return

  const initialized = await mcpRequest(token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'pinsquirrel-e2e', version: '1.0.0' },
    },
  })
  expect(initialized.status).toBe(200)

  await mcpRequest(token, {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  })

  mcpInitialized = true
}

/** Call a tool the way a client does, once the handshake is out of the way. */
async function callListPins(token: string): Promise<Response> {
  await mcpHandshake(token)
  return mcpRequest(token, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'list_pins', arguments: {} },
  })
}

// State the steps hand to each other, in the order they are established.
let userId: string
let sessionToken: string
let metadata: AuthorizationServerMetadata
let mcpMetadataPath: string
let mcpResource: string
let apiResource: string
let authorizationServer: string
let clientId: string
const otherClientIds: string[] = []
let mcpTokens: TokenResponse
let apiTokens: TokenResponse
let mcpInitialized = false

beforeAll(async () => {
  const username = `e2e${randomBytes(6).toString('hex')}`
  const email = `${username}@example.test`

  // The real signup service, so the user, its `User` role and its email hash
  // are made the way a real account is.
  accountService.register({ username, email })
  const user = await vi.waitFor(async () => {
    const created = await userRepository.findByUsername(username)
    if (!created) throw new Error('Signup did not create the test user')
    return created
  })
  userId = user.id
  await userRepository.update(userId, { status: UserStatus.Active })

  // Seeding, not behaviour: signup leaves an account with no password (it is
  // set from an emailed reset link), so there is no password to sign in with
  // from here. The session row and the cookie below are exactly what
  // `sessionManager.create` writes, and every request after this resolves it
  // through the real session middleware.
  sessionToken = randomBytes(32).toString('base64url')
  await sessionRepository.create({
    id: createHash('sha256').update(sessionToken).digest('hex'),
    userId,
    data: { userId, keepSignedIn: true },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
})

afterAll(async () => {
  // Deleting the user takes its session, authorization codes and tokens with
  // it: all three cascade from `users.id`. The client this run registered has
  // nothing to cascade from, so it goes explicitly.
  if (userId) await userRepository.delete(userId)
  for (const id of [clientId, ...otherClientIds]) {
    const client = id ? await oauthClientRepository.findByClientId(id) : null
    if (client) await oauthClientRepository.delete(client.id)
  }
  // The pool would otherwise hold the worker open once the run is over.
  // `DatabaseClient` does not surface it, so it is reached by cast here
  // rather than widened in the package's public type for one test.
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end()
})

describe('OAuth discovery', () => {
  it('answers an unauthenticated tool call with a 401 that says where to look', async () => {
    const res = await request(MCP_PATH, {
      ...json({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_pins', arguments: {} },
      }),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
    })

    expect(res.status).toBe(401)

    mcpMetadataPath = pathOf(
      resourceMetadataUrl(res.headers.get('WWW-Authenticate'))
    )
    expect(mcpMetadataPath).toBe('/.well-known/oauth-protected-resource/mcp')
  })

  it('serves the protected resource document the challenge named', async () => {
    const res = await request(mcpMetadataPath)
    const document = (await res.json()) as {
      resource: string
      authorization_servers: string[]
      scopes_supported: string[]
    }

    expect(res.status).toBe(200)
    expect(document.resource).toBe('http://localhost:8100/mcp')
    expect(document.scopes_supported).toEqual([
      'pins:read',
      'tags:read',
      'pins:write',
      'tags:write',
    ])
    expect(document.authorization_servers).toHaveLength(1)

    mcpResource = document.resource
    authorizationServer = document.authorization_servers[0]
  })

  it('serves the authorization server document that resource points at', async () => {
    // RFC 8414: the well-known segment goes in front of the issuer's path,
    // and the issuer here has none.
    const res = await request(
      pathOf(`${authorizationServer}/.well-known/oauth-authorization-server`)
    )
    metadata = (await res.json()) as AuthorizationServerMetadata

    expect(res.status).toBe(200)
    expect(metadata.issuer).toBe(authorizationServer)
    expect(metadata.authorization_endpoint).toBeTruthy()
    expect(metadata.token_endpoint).toBeTruthy()
    expect(metadata.registration_endpoint).toBeTruthy()
    expect(metadata.revocation_endpoint).toBeTruthy()
  })
})

describe('client registration', () => {
  it('registers a client on the loopback redirect a native client declares', async () => {
    const res = await request(
      pathOf(metadata.registration_endpoint),
      json({
        client_name: CLIENT_NAME,
        redirect_uris: [REGISTERED_REDIRECT_URI],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      })
    )
    const client = (await res.json()) as {
      client_id: string
      client_name: string
      redirect_uris: string[]
      token_endpoint_auth_method: string
    }

    expect(res.status).toBe(201)
    expect(client.client_name).toBe(CLIENT_NAME)
    expect(client.redirect_uris).toEqual([REGISTERED_REDIRECT_URI])
    // A public client: there is no secret in the response because none is
    // issued and none would be checked.
    expect(client.token_endpoint_auth_method).toBe('none')
    expect(client).not.toHaveProperty('client_secret')

    clientId = client.client_id
  })
})

describe('authorization', () => {
  const { verifier, challenge } = pkcePair()
  const state = randomUUID()
  let query: Record<string, string>
  let code: string

  it('shows the consent screen, naming the client and the host it sends back to', async () => {
    query = authorizationQuery({
      challenge,
      resource: mcpResource,
      scope: 'pins:read tags:read offline_access',
      state,
    })

    const res = await browserRequest(
      `${pathOf(metadata.authorization_endpoint)}?${new URLSearchParams(query).toString()}`
    )
    const page = await res.text()

    expect(res.status).toBe(200)
    expect(page).toContain(CLIENT_NAME)
    // The loopback host is the whole defence against a local process
    // impersonating a known client, so it is on the page in full.
    expect(page).toContain('127.0.0.1')
    expect(page).toContain('offline_access')
  })

  it('redirects to the callback carrying code, the same state, and iss', async () => {
    const callback = await approve(query)

    expect(callback.origin).toBe(new URL(EPHEMERAL_REDIRECT_URI).origin)
    expect(callback.pathname).toBe('/callback')
    expect(callback.searchParams.get('state')).toBe(state)
    // RFC 9207: which authorization server answered.
    expect(callback.searchParams.get('iss')).toBe(metadata.issuer)
    expect(callback.searchParams.get('error')).toBeNull()

    code = callback.searchParams.get('code') ?? ''
    expect(code).not.toBe('')
  })

  it('exchanges the code for a pso_ access token and a refresh token', async () => {
    const res = await exchange({
      grant_type: 'authorization_code',
      code,
      redirect_uri: query.redirect_uri,
      client_id: clientId,
      code_verifier: verifier,
    })
    mcpTokens = (await res.json()) as TokenResponse

    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(mcpTokens.token_type).toBe('Bearer')
    expect(mcpTokens.access_token.startsWith('pso_')).toBe(true)
    expect(mcpTokens.expires_in).toBe(3600)
    // offline_access was granted, so the client can refresh unattended.
    expect(mcpTokens.refresh_token).toBeTruthy()
    expect(mcpTokens.scope).toBe('pins:read tags:read offline_access')
  })

  it('refuses a second exchange of the same code, and ends the tokens of the first', async () => {
    const tokenRequest = await authorizeForCode({ resource: mcpResource })
    const first = (await (await exchange(tokenRequest)).json()) as TokenResponse
    expect((await callListPins(first.access_token)).status).toBe(200)

    const res = await exchange(tokenRequest)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' })
    expect((await callListPins(first.access_token)).status).toBe(401)
    const refresh = await exchange({
      grant_type: 'refresh_token',
      refresh_token: first.refresh_token ?? '',
      client_id: clientId,
    })
    expect(refresh.status).toBe(400)
    expect((await callListPins(mcpTokens.access_token)).status).toBe(200)
  })

  it('refuses the exchange when the PKCE verifier does not match', async () => {
    const other = pkcePair()
    const fresh = authorizationQuery({
      challenge: other.challenge,
      resource: mcpResource,
      scope: 'pins:read',
      state: randomUUID(),
    })
    const callback = await approve(fresh)

    const res = await exchange({
      grant_type: 'authorization_code',
      code: callback.searchParams.get('code') ?? '',
      redirect_uri: fresh.redirect_uri,
      client_id: clientId,
      code_verifier: pkcePair().verifier,
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' })
  })
})

describe('audience binding', () => {
  it('opens /mcp with a token minted for /mcp', async () => {
    const res = await callListPins(mcpTokens.access_token)
    const body = (await res.json()) as {
      result?: { isError?: boolean; content: { text: string }[] }
      error?: unknown
    }

    expect(res.status).toBe(200)
    expect(body.error).toBeUndefined()
    expect(body.result?.isError).toBeFalsy()
    // The tool answered for this user's collection, which is empty rather
    // than absent: a brand new account with no pins.
    expect(JSON.parse(body.result?.content[0].text ?? '{}')).toMatchObject({
      pins: [],
    })
  })

  it('refuses that same token at /api/v1, which is a different audience', async () => {
    const res = await request('/api/v1/pins', {
      headers: { Authorization: `Bearer ${mcpTokens.access_token}` },
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'invalid_token' })
    expect(resourceMetadataUrl(res.headers.get('WWW-Authenticate'))).toContain(
      '/.well-known/oauth-protected-resource/api/v1'
    )
  })

  it('mints a token for the REST resource and finds it refused at /mcp', async () => {
    const document = await request(
      '/.well-known/oauth-protected-resource/api/v1'
    )
    apiResource = ((await document.json()) as { resource: string }).resource
    apiTokens = await connect({ resource: apiResource })

    const rest = await request('/api/v1/pins', {
      headers: { Authorization: `Bearer ${apiTokens.access_token}` },
    })
    expect(rest.status).toBe(200)
    expect(await rest.json()).toMatchObject({ pins: [] })

    const mcp = await mcpRequest(apiTokens.access_token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
    expect(mcp.status).toBe(401)
    expect(await mcp.json()).toMatchObject({ error: 'invalid_token' })
  })

  it('refuses to authorize a resource this server issues no tokens for', async () => {
    const query = authorizationQuery({
      challenge: pkcePair().challenge,
      resource: 'https://example.com/mcp',
      scope: 'pins:read',
      state: randomUUID(),
    })

    const res = await browserRequest(
      `${pathOf(metadata.authorization_endpoint)}?${new URLSearchParams(query).toString()}`
    )

    expectRedirectedError(res, query, 'invalid_target')
  })

  it('refuses a token request naming a resource the code was not issued for', async () => {
    const { verifier, challenge } = pkcePair()
    const query = authorizationQuery({
      challenge,
      resource: mcpResource,
      scope: 'pins:read',
      state: randomUUID(),
    })
    const callback = await approve(query)

    const res = await exchange({
      grant_type: 'authorization_code',
      code: callback.searchParams.get('code') ?? '',
      redirect_uri: query.redirect_uri,
      client_id: clientId,
      code_verifier: verifier,
      resource: apiResource,
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_target' })
  })
})

describe('consent screen identity', () => {
  it('names a client registered with an empty name by its client_id, and says the name is unverified', async () => {
    const registered = await request(
      pathOf(metadata.registration_endpoint),
      json({
        client_name: '',
        redirect_uris: [REGISTERED_REDIRECT_URI],
        token_endpoint_auth_method: 'none',
      })
    )
    expect(registered.status).toBe(201)
    const unnamed = ((await registered.json()) as { client_id: string })
      .client_id
    otherClientIds.push(unnamed)
    const query = {
      ...authorizationQuery({
        challenge: pkcePair().challenge,
        resource: mcpResource,
        scope: 'pins:read',
        state: randomUUID(),
      }),
      client_id: unnamed,
    }

    const res = await browserRequest(
      `${pathOf(metadata.authorization_endpoint)}?${new URLSearchParams(query).toString()}`
    )

    expect(res.status).toBe(200)
    const page = (await res.text()).replace(/<input[^>]*>/g, '')
    expect(page).toContain(`Authorize ${unnamed}`)
    expect(page).toContain('not verified')
  })
})

describe('authorization errors', () => {
  function getAuthorize(query: Record<string, string>): Promise<Response> {
    return browserRequest(
      `${pathOf(metadata.authorization_endpoint)}?${new URLSearchParams(query).toString()}`
    )
  }

  function readQuery(scope = 'pins:read'): Record<string, string> {
    return authorizationQuery({
      challenge: pkcePair().challenge,
      resource: mcpResource,
      scope,
      state: randomUUID(),
    })
  }

  it('redirects an unknown scope as invalid_scope, without repeating it', async () => {
    const query = readQuery('Your account is suspended')

    const res = await getAuthorize(query)

    const location = expectRedirectedError(res, query, 'invalid_scope')
    expect(location.searchParams.get('error_description')).not.toContain(
      'suspended'
    )
  })

  it('redirects a request without a code_challenge as invalid_request', async () => {
    const query = readQuery()
    delete query.code_challenge

    expectRedirectedError(await getAuthorize(query), query, 'invalid_request')
  })

  it('redirects a client not registered for the code grant as unauthorized_client', async () => {
    const registered = await request(
      pathOf(metadata.registration_endpoint),
      json({
        client_name: 'Refresh-only client',
        redirect_uris: [REGISTERED_REDIRECT_URI],
        grant_types: ['refresh_token'],
        token_endpoint_auth_method: 'none',
      })
    )
    expect(registered.status).toBe(201)
    const refreshOnly = ((await registered.json()) as { client_id: string })
      .client_id
    otherClientIds.push(refreshOnly)
    const query = { ...readQuery(), client_id: refreshOnly }

    expectRedirectedError(
      await getAuthorize(query),
      query,
      'unauthorized_client'
    )
  })

  it('renders a redirect URI the client never registered, and sends nothing there', async () => {
    const query = authorizationQuery({
      challenge: pkcePair().challenge,
      resource: mcpResource,
      scope: 'pins:read',
      state: randomUUID(),
      redirectUri: 'http://127.0.0.1:53211/elsewhere',
    })

    const res = await getAuthorize(query)

    expect(res.status).toBe(400)
    expect(res.headers.get('Location')).toBeNull()
    expect(await res.text()).toContain('invalid_request')
  })
})

describe('read scopes', () => {
  async function callTool(
    token: string,
    name: string
  ): Promise<{ isError?: boolean; content: { text: string }[] }> {
    await mcpHandshake(token)
    const res = await mcpRequest(token, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name, arguments: {} },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      result?: { isError?: boolean; content: { text: string }[] }
    }
    return body.result!
  }

  it('refuses list_pins and get_pin over MCP to a grant without pins:read', async () => {
    const tokens = await connect({ resource: mcpResource, scope: 'tags:read' })

    const listed = await callTool(tokens.access_token, 'list_pins')
    expect(listed.isError).toBe(true)
    expect(listed.content[0].text).toContain('pins:read')

    await mcpHandshake(tokens.access_token)
    const got = await mcpRequest(tokens.access_token, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_pin', arguments: { id: 'any-pin-id' } },
    })
    const body = (await got.json()) as {
      result: { isError?: boolean; content: { text: string }[] }
    }
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain('pins:read')
  })

  it('refuses list_tags over MCP to a grant without tags:read', async () => {
    const tokens = await connect({ resource: mcpResource, scope: 'pins:read' })

    const listed = await callTool(tokens.access_token, 'list_tags')
    expect(listed.isError).toBe(true)
    expect(listed.content[0].text).toContain('tags:read')
  })

  it('answers the REST pin reads with 403 insufficient_scope without pins:read', async () => {
    const tokens = await connect({ resource: apiResource, scope: 'tags:read' })

    for (const path of [
      '/api/v1/pins',
      '/api/v1/pins/any-pin-id',
      '/api/v1/tags/any-tag-id/pins',
    ]) {
      const res = await request(path, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      expect(res.status, path).toBe(403)
      expect(res.headers.get('WWW-Authenticate'), path).toContain(
        'scope="pins:read"'
      )
    }
  })

  it('answers GET /api/v1/tags with 403 without tags:read', async () => {
    const tokens = await connect({ resource: apiResource, scope: 'pins:read' })

    const res = await request('/api/v1/tags', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    expect(res.status).toBe(403)
    expect(res.headers.get('WWW-Authenticate')).toContain('scope="tags:read"')
  })
})

/**
 * The scope, end to end: two connections for the same user against the same
 * server, differing only in what the consent screen granted.
 *
 * This is the test Phase 8 left open on purpose. `mcp/scopes.test.ts` proves
 * `requireScope` throws, and `routes/mcp-write-tools.test.ts` proves a tool
 * calls it - but neither can show that the scope a real token carries is the
 * one the guard reads, because in both the token is a fixture. Here the scope
 * travels the whole way: authorization request, consent, token endpoint,
 * `AuthInfo`, tool. A write that got through on a read-only grant would mean
 * every scope on the consent screen is decoration.
 */
describe('write scopes', () => {
  const WRITE_SCOPES = 'pins:read tags:read pins:write tags:write'
  let writeTokens: TokenResponse
  let createdPinId: string

  /** A tool result's pin tags, sorted so the assertion does not depend on order. */
  function tagsOf(text: string): string[] {
    return [...(JSON.parse(text) as { tagNames: string[] }).tagNames].sort()
  }

  async function callWriteTool(
    token: string,
    name: string,
    args: Record<string, unknown>
  ): Promise<{ isError?: boolean; content: { text: string }[] }> {
    await mcpHandshake(token)
    const res = await mcpRequest(token, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name, arguments: args },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      result?: { isError?: boolean; content: { text: string }[] }
      error?: unknown
    }
    expect(body.error).toBeUndefined()
    return body.result!
  }

  it('refuses update_pin on a grant that is only read scopes', async () => {
    // The connection made at the top of this file, which asked for the two
    // reads and nothing else.
    const result = await callWriteTool(mcpTokens.access_token, 'update_pin', {
      id: 'any-pin-id',
      tagNames: ['rust'],
    })

    expect(result.isError).toBe(true)
    // Named, because a scope the connection was never granted is the one
    // failure retrying cannot fix - the client has to re-authorize.
    expect(result.content[0].text).toContain('pins:write')
  })

  it('creates a pin once the user has approved pins:write', async () => {
    writeTokens = await connect({ resource: mcpResource, scope: WRITE_SCOPES })
    expect(writeTokens.scope).toBe(WRITE_SCOPES)

    const result = await callWriteTool(writeTokens.access_token, 'create_pin', {
      url: 'https://example.com/phase-10',
      title: 'Phase 10',
      tagNames: ['scratch'],
    })

    expect(result.isError).toBeFalsy()
    const pin = JSON.parse(result.content[0].text) as {
      id: string
      tagNames: string[]
      isPrivate: boolean
    }
    expect(pin.tagNames).toEqual(['scratch'])
    // Nothing in the input could have asked for anything else.
    expect(pin.isPrivate).toBe(false)

    createdPinId = pin.id
  })

  it('retags that pin, replacing its tags rather than adding to them', async () => {
    const result = await callWriteTool(writeTokens.access_token, 'update_pin', {
      id: createdPinId,
      tagNames: ['rust', 'systems'],
    })

    expect(result.isError).toBeFalsy()
    // Sorted because the repository returns a pin's tags in no promised
    // order, and this case is about which tags the pin has, not their order.
    expect(tagsOf(result.content[0].text)).toEqual(['rust', 'systems'])

    // And the read half agrees, which is the whole point of a write tool.
    const read = await callWriteTool(writeTokens.access_token, 'get_pin', {
      id: createdPinId,
    })
    expect(tagsOf(read.content[0].text)).toEqual(['rust', 'systems'])
  })

  it('deletes it again', async () => {
    const result = await callWriteTool(writeTokens.access_token, 'delete_pin', {
      id: createdPinId,
    })
    expect(result.isError).toBeFalsy()

    const gone = await callWriteTool(writeTokens.access_token, 'get_pin', {
      id: createdPinId,
    })
    expect(gone.isError).toBe(true)
    expect(gone.content[0].text).toBe('Pin not found')
  })
})

describe('refresh rotation', () => {
  let rotated: TokenResponse

  it('exchanges the refresh token for a new pair', async () => {
    const res = await exchange({
      grant_type: 'refresh_token',
      refresh_token: mcpTokens.refresh_token ?? '',
      client_id: clientId,
    })
    rotated = (await res.json()) as TokenResponse

    expect(res.status).toBe(200)
    expect(rotated.access_token).not.toBe(mcpTokens.access_token)
    expect(rotated.refresh_token).toBeTruthy()
    expect(rotated.refresh_token).not.toBe(mcpTokens.refresh_token)

    const call = await callListPins(rotated.access_token)
    expect(call.status).toBe(200)
  })

  const replayOriginal = () =>
    exchange({
      grant_type: 'refresh_token',
      refresh_token: mcpTokens.refresh_token ?? '',
      client_id: clientId,
    })

  async function afterTheGraceWindow(run: () => Promise<void>): Promise<void> {
    vi.useFakeTimers({
      toFake: ['Date'],
      now: Date.now() + REFRESH_ROTATION_GRACE_MS + 1000,
    })
    try {
      await run()
    } finally {
      vi.useRealTimers()
    }
  }

  it('refuses the retired refresh token moments later, and leaves the new pair working', async () => {
    const replay = await replayOriginal()

    expect(replay.status).toBe(400)
    expect(await replay.json()).toMatchObject({ error: 'invalid_grant' })
    expect((await callListPins(rotated.access_token)).status).toBe(200)
  })

  it('kills the whole grant when the retired refresh token is presented again later', async () => {
    await afterTheGraceWindow(async () => {
      const replay = await replayOriginal()

      expect(replay.status).toBe(400)
      expect(await replay.json()).toMatchObject({ error: 'invalid_grant' })

      const successor = await exchange({
        grant_type: 'refresh_token',
        refresh_token: rotated.refresh_token ?? '',
        client_id: clientId,
      })
      expect(successor.status).toBe(400)
      expect(await successor.json()).toMatchObject({ error: 'invalid_grant' })

      const call = await mcpRequest(rotated.access_token, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      })
      expect(call.status).toBe(401)
    })
  })

  it('still kills the grant when the retired token comes back after a sweep', async () => {
    const original = await connect({ resource: mcpResource })
    const res = await exchange({
      grant_type: 'refresh_token',
      refresh_token: original.refresh_token ?? '',
      client_id: clientId,
    })
    expect(res.status).toBe(200)
    const successor = (await res.json()) as TokenResponse

    await maintenanceService.sweepExpired()

    await afterTheGraceWindow(async () => {
      const replay = await exchange({
        grant_type: 'refresh_token',
        refresh_token: original.refresh_token ?? '',
        client_id: clientId,
      })
      expect(replay.status).toBe(400)

      const call = await mcpRequest(successor.access_token, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      })
      expect(call.status).toBe(401)
    })
  })

  it('narrows one access token on request and keeps the grant whole', async () => {
    const original = await connect({ resource: mcpResource })

    const narrowed = await exchange({
      grant_type: 'refresh_token',
      refresh_token: original.refresh_token ?? '',
      client_id: clientId,
      scope: 'pins:read',
    })
    const narrow = (await narrowed.json()) as TokenResponse
    expect(narrowed.status).toBe(200)
    expect(narrow.scope).toBe('pins:read')
    expect(narrow.refresh_token).toBeTruthy()

    const next = await exchange({
      grant_type: 'refresh_token',
      refresh_token: narrow.refresh_token ?? '',
      client_id: clientId,
    })
    expect(next.status).toBe(200)
    expect(((await next.json()) as TokenResponse).scope).toBe(
      'pins:read tags:read offline_access'
    )
  })

  it('lets one of two concurrent refreshes win, and its tokens work', async () => {
    const original = await connect({ resource: mcpResource })
    const refresh = () =>
      exchange({
        grant_type: 'refresh_token',
        refresh_token: original.refresh_token ?? '',
        client_id: clientId,
      })

    const responses = await Promise.all([refresh(), refresh()])

    expect(responses.map(res => res.status).sort()).toEqual([200, 400])
    const winner = responses.find(res => res.status === 200)
    const issued = (await winner?.json()) as TokenResponse
    expect((await callListPins(issued.access_token)).status).toBe(200)
  })
})

describe('revocation', () => {
  it('revokes a live grant from the profile page, and the client notices', async () => {
    const granted = await connect({ resource: mcpResource })
    expect((await callListPins(granted.access_token)).status).toBe(200)

    const page = await browserRequest('/profile')
    const html = await page.text()
    expect(html).toContain(CLIENT_NAME)

    // The form the page actually renders, read the way a browser posts it.
    const grantClientId =
      /name="clientId" value="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(grantClientId).not.toBe('')

    const revoked = await browserRequest(
      '/profile',
      form({ intent: 'revoke-oauth-grant', clientId: grantClientId })
    )
    expect(revoked.status).toBe(302)

    const call = await mcpRequest(granted.access_token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
    expect(call.status).toBe(401)
  })

  it('accepts a token handed back to the revocation endpoint (RFC 7009)', async () => {
    const granted = await connect({ resource: mcpResource })

    const res = await request(
      pathOf(metadata.revocation_endpoint),
      form({ token: granted.access_token, client_id: clientId })
    )
    expect(res.status).toBe(200)

    const call = await mcpRequest(granted.access_token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })
    expect(call.status).toBe(401)
  })
})

describe('two connections of one client', () => {
  const toolsList = (token: string) =>
    mcpRequest(token, { jsonrpc: '2.0', id: 1, method: 'tools/list' })

  it('ends only the connection whose refresh token is handed back', async () => {
    const laptop = await connect({ resource: mcpResource })
    const desktop = await connect({ resource: mcpResource })

    const res = await request(
      pathOf(metadata.revocation_endpoint),
      form({ token: laptop.refresh_token ?? '', client_id: clientId })
    )
    expect(res.status).toBe(200)

    expect((await toolsList(laptop.access_token)).status).toBe(401)
    expect((await toolsList(desktop.access_token)).status).toBe(200)
    const refreshed = await exchange({
      grant_type: 'refresh_token',
      refresh_token: desktop.refresh_token ?? '',
      client_id: clientId,
    })
    expect(refreshed.status).toBe(200)
  })
})

describe('expiry', () => {
  it('refuses an access token whose lifetime has run out', async () => {
    // The one place this test reaches a repository directly: it is seeding
    // state, not exercising behaviour, and an hour of an access token's life
    // cannot be waited out. The hash is what `hashToken` stores.
    const raw = `pso_${randomBytes(32).toString('base64url')}`
    await oauthTokenRepository.create({
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      kind: 'access',
      clientId,
      userId,
      scopes: ['pins:read', 'tags:read'],
      resource: mcpResource,
      grantId: randomUUID(),
      expiresAt: new Date(Date.now() - 1000),
    })

    const res = await mcpRequest(raw, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'invalid_token' })
  })
})
