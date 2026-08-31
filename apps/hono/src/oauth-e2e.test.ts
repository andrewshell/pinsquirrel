import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from './app'
import {
  db,
  oauthClientRepository,
  oauthTokenRepository,
  sessionRepository,
  userRepository,
} from './lib/db'
import { accountService } from './lib/services'

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

/**
 * A documentation address (RFC 5737), so every rate limiter in the app buckets
 * this file's requests apart from the `unknown` key the other route tests
 * share. `getClientIp` only reads the header when `TRUST_PROXY` is set, which
 * `beforeAll` does.
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
  const headers = new Headers(init.headers)
  headers.set('x-forwarded-for', CLIENT_IP)
  return app.request(path, { ...init, headers })
}

/** A request from the signed-in browser: session cookie, and an Origin CSRF accepts. */
function browserRequest(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Cookie', `__session=${sessionId}`)
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

/**
 * A whole connection: consent, approval, and the token exchange the callback
 * triggers. Returns what the client ends up holding.
 */
async function connect(input: {
  resource: string
  scope?: string
}): Promise<TokenResponse> {
  const { verifier, challenge } = pkcePair()
  const query = authorizationQuery({
    challenge,
    resource: input.resource,
    scope: input.scope ?? 'pins:read tags:read offline_access',
    state: randomUUID(),
  })

  const callback = await approve(query)
  const res = await exchange({
    grant_type: 'authorization_code',
    code: callback.searchParams.get('code') ?? '',
    redirect_uri: query.redirect_uri,
    client_id: clientId,
    code_verifier: verifier,
  })

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
let sessionId: string
let metadata: AuthorizationServerMetadata
let mcpMetadataPath: string
let mcpResource: string
let apiResource: string
let authorizationServer: string
let clientId: string
let mcpTokens: TokenResponse
let apiTokens: TokenResponse
let mcpInitialized = false

beforeAll(async () => {
  // The IP-keyed limiters read the forwarding header only when a proxy is
  // trusted, which is how this file gets a bucket of its own.
  process.env.TRUST_PROXY = '1'

  const username = `e2e${randomBytes(6).toString('hex')}`
  const email = `${username}@example.test`

  // The real signup service, so the user, its `User` role and its email hash
  // are made the way a real account is.
  await accountService.register({ username, email })
  const user = await userRepository.findByUsername(username)
  if (!user) throw new Error('Signup did not create the test user')
  userId = user.id

  // Seeding, not behaviour: signup leaves an account with no password (it is
  // set from an emailed reset link), so there is no password to sign in with
  // from here. The session row and the cookie below are exactly what
  // `sessionManager.create` writes, and every request after this resolves it
  // through the real session middleware.
  const session = await sessionRepository.create({
    userId,
    data: { userId, keepSignedIn: true },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  sessionId = session.id
})

afterAll(async () => {
  delete process.env.TRUST_PROXY

  // Deleting the user takes its session, authorization codes and tokens with
  // it: all three cascade from `users.id`. The client this run registered has
  // nothing to cascade from, so it goes explicitly.
  if (userId) await userRepository.delete(userId)
  if (clientId) {
    const client = await oauthClientRepository.findByClientId(clientId)
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

  it('refuses a second exchange of the same code', async () => {
    const res = await exchange({
      grant_type: 'authorization_code',
      code,
      redirect_uri: query.redirect_uri,
      client_id: clientId,
      code_verifier: verifier,
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' })
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

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('invalid_target')
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

  it('kills the whole grant when the retired refresh token is presented again', async () => {
    const replay = await exchange({
      grant_type: 'refresh_token',
      refresh_token: mcpTokens.refresh_token ?? '',
      client_id: clientId,
    })

    expect(replay.status).toBe(400)
    expect(await replay.json()).toMatchObject({ error: 'invalid_grant' })

    // There is no telling a client replaying its own token from somebody
    // holding a copy, so the successor dies with it and the user re-consents.
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

describe('revocation', () => {
  it('revokes a live grant from the profile page, and the client notices', async () => {
    const granted = await connect({ resource: mcpResource })
    expect((await callListPins(granted.access_token)).status).toBe(200)

    const page = await browserRequest('/profile')
    const html = await page.text()
    expect(html).toContain(CLIENT_NAME)

    // The form the page actually renders, read the way a browser posts it.
    const tokenId = /name="tokenId" value="([^"]+)"/.exec(html)?.[1] ?? ''
    expect(tokenId).not.toBe('')

    const revoked = await browserRequest(
      '/profile',
      form({ intent: 'revoke-oauth-grant', tokenId })
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
