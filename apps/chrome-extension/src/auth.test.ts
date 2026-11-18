import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authorizedFetch,
  buildAuthorizationUrl,
  completeConnect,
  disconnect,
  getAccessToken,
  OAuthProtocolError,
  ReauthorizationRequiredError,
  readAuthorizationRedirect,
  startConnect,
} from './auth.ts'
import type { OAuthEndpoints } from './oauth-metadata.ts'
import { pkceChallengeFor } from './pkce.ts'
import { jsonResponse } from './test/fetch-mock.ts'
import {
  BASE_URL as SERVER_BASE_URL,
  CALLBACK_URL,
  oauthErrorResponse,
  REGISTERED_CLIENT_ID,
  RESOURCE,
  stubOAuthServer,
  tokenResponse,
} from './test/oauth-server.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const BASE_URL = 'https://pinsquirrel.com'

const ENDPOINTS: OAuthEndpoints = {
  resource: `${BASE_URL}/api/v1`,
  issuer: BASE_URL,
  authorizationEndpoint: `${BASE_URL}/oauth/authorize`,
  tokenEndpoint: `${BASE_URL}/oauth/token`,
  registrationEndpoint: `${BASE_URL}/oauth/register`,
  revocationEndpoint: `${BASE_URL}/oauth/revoke`,
}

const REDIRECT_URI = 'https://extensionid.chromiumapp.org/'

describe('buildAuthorizationUrl', () => {
  it('asks for a code against the api/v1 resource, with an S256 challenge', () => {
    const url = new URL(
      buildAuthorizationUrl({
        endpoints: ENDPOINTS,
        clientId: 'dcr_abc',
        redirectUri: REDIRECT_URI,
        challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        state: 'state-123',
      })
    )

    expect(`${url.origin}${url.pathname}`).toBe(ENDPOINTS.authorizationEndpoint)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'dcr_abc',
      redirect_uri: REDIRECT_URI,
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
      scope: 'pins:read tags:read offline_access',
      state: 'state-123',
      // RFC 8707. A token minted for the /mcp resource must not work on
      // /api/v1, so the audience is named on the request (Decision 16).
      resource: `${BASE_URL}/api/v1`,
    })
  })
})

describe('readAuthorizationRedirect', () => {
  it('returns the code Chrome landed on', () => {
    const code = readAuthorizationRedirect(
      `${REDIRECT_URI}?code=abc123&state=state-123&iss=${encodeURIComponent(BASE_URL)}`,
      { state: 'state-123', issuer: BASE_URL }
    )

    expect(code).toBe('abc123')
  })

  it('refuses a redirect whose state is not the one it sent', () => {
    expect(() =>
      readAuthorizationRedirect(`${REDIRECT_URI}?code=abc123&state=forged`, {
        state: 'state-123',
        issuer: BASE_URL,
      })
    ).toThrow(/state/i)
  })

  it("surfaces the server's own error code when consent is refused", () => {
    let thrown: unknown
    try {
      readAuthorizationRedirect(
        `${REDIRECT_URI}?error=access_denied&error_description=You+said+no&state=state-123`,
        { state: 'state-123', issuer: BASE_URL }
      )
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(OAuthProtocolError)
    expect((thrown as OAuthProtocolError).code).toBe('access_denied')
    expect((thrown as OAuthProtocolError).message).toContain('You said no')
  })

  // RFC 9207: the server advertises the iss parameter, so a redirect claiming
  // to come from somewhere else is a mix-up attempt.
  it('refuses a redirect that names another issuer', () => {
    expect(() =>
      readAuthorizationRedirect(
        `${REDIRECT_URI}?code=abc123&state=state-123&iss=https%3A%2F%2Fevil.test`,
        { state: 'state-123', issuer: BASE_URL }
      )
    ).toThrow(/issuer/i)
  })
})

describe('startConnect', () => {
  it('registers at the site callback and hands back the consent URL', async () => {
    const server = stubOAuthServer()

    const url = new URL(await startConnect(SERVER_BASE_URL))

    // Registered as a public client at a page on the server itself: the
    // consent screen runs in an ordinary tab, and the worker reads the code
    // off that page's URL. No extension-owned callback is involved.
    expect(server.registrations).toEqual([
      {
        client_name: 'PinSquirrel Chrome Extension',
        redirect_uris: [CALLBACK_URL],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
    ])
    expect(`${url.origin}${url.pathname}`).toBe(
      `${SERVER_BASE_URL}/oauth/authorize`
    )
    expect(url.searchParams.get('client_id')).toBe(REGISTERED_CLIENT_ID)
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK_URL)
  })

  it('remembers the half-open flow, because the worker may be unloaded before the answer', async () => {
    const server = stubOAuthServer()

    const url = new URL(await startConnect(SERVER_BASE_URL))

    expect(server.chrome.local.items.pendingConnect).toMatchObject({
      baseUrl: SERVER_BASE_URL,
      clientId: REGISTERED_CLIENT_ID,
      redirectUri: CALLBACK_URL,
      state: url.searchParams.get('state'),
      verifier: expect.any(String) as string,
    })
  })

  it("fails with the server's reason when registration is refused, and can be retried", async () => {
    const server = stubOAuthServer()
    let refusals = 1
    server.fetched.route(`${SERVER_BASE_URL}/oauth/register`, () =>
      refusals-- > 0
        ? jsonResponse(
            {
              error: 'too_many_requests',
              error_description: 'Too many client registrations.',
            },
            429
          )
        : jsonResponse({ client_id: REGISTERED_CLIENT_ID }, 201)
    )

    await expect(startConnect(SERVER_BASE_URL)).rejects.toThrow(
      'Too many client registrations.'
    )
    expect(server.chrome.local.items.registeredClients).toBeUndefined()
    expect(server.chrome.local.items.pendingConnect).toBeUndefined()

    const url = new URL(await startConnect(SERVER_BASE_URL))
    expect(url.searchParams.get('client_id')).toBe(REGISTERED_CLIENT_ID)
  })

  it('reuses a cached registration rather than registering again', async () => {
    const server = stubOAuthServer({
      registeredClients: { [SERVER_BASE_URL]: 'dcr_cached' },
    })

    const url = new URL(await startConnect(SERVER_BASE_URL))

    expect(server.registrations).toEqual([])
    expect(url.searchParams.get('client_id')).toBe('dcr_cached')
  })
})

describe('completeConnect', () => {
  it('spends the code the callback carries and stores the tokens', async () => {
    const server = stubOAuthServer()
    const url = await startConnect(SERVER_BASE_URL)

    const outcome = await completeConnect(server.consent(url))

    expect(outcome).toEqual({ status: 'connected' })
    expect(server.tokenRequests).toEqual([
      {
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: CALLBACK_URL,
        client_id: REGISTERED_CLIENT_ID,
        code_verifier: expect.any(String) as string,
        resource: RESOURCE,
      },
    ])
    expect(server.chrome.local.items).toMatchObject({
      baseUrl: SERVER_BASE_URL,
      clientId: REGISTERED_CLIENT_ID,
      accessToken: 'pso_access',
      refreshToken: 'refresh-1',
      expiresAt: expect.any(Number) as number,
    })
    expect(server.chrome.local.items.pendingConnect).toBeUndefined()
  })

  it('proves it started the flow: the verifier it sends hashes to the challenge it sent', async () => {
    const server = stubOAuthServer()
    const url = await startConnect(SERVER_BASE_URL)

    await completeConnect(server.consent(url))

    const challenge =
      server.authorizations[0].searchParams.get('code_challenge')
    const verifier = server.tokenRequests[0].code_verifier

    expect(challenge).toBe(await pkceChallengeFor(verifier))
  })

  it('re-registers and asks for a fresh consent when the server has forgotten the cached client', async () => {
    const server = stubOAuthServer({
      registeredClients: { [SERVER_BASE_URL]: 'dcr_stale' },
    })
    server.answerTokenWith(form =>
      form.client_id === 'dcr_stale'
        ? oauthErrorResponse('invalid_client', 401)
        : tokenResponse()
    )
    const first = await startConnect(SERVER_BASE_URL)

    const outcome = await completeConnect(server.consent(first))

    // The code was spent on the way in, so the only way on is a new consent
    // against a fresh registration - handed back as a URL for the worker to
    // send the same tab to.
    expect(outcome).toMatchObject({ status: 'restart' })
    expect(server.registrations).toHaveLength(1)
    const second = (outcome as { url: string }).url
    expect(new URL(second).searchParams.get('client_id')).toBe(
      REGISTERED_CLIENT_ID
    )

    await expect(completeConnect(server.consent(second))).resolves.toEqual({
      status: 'connected',
    })
    expect(server.chrome.local.items).toMatchObject({
      clientId: REGISTERED_CLIENT_ID,
      registeredClients: { [SERVER_BASE_URL]: REGISTERED_CLIENT_ID },
    })
  })

  it('refuses a callback when no flow was started', async () => {
    stubOAuthServer()

    await expect(
      completeConnect(`${CALLBACK_URL}?code=abc&state=nope`)
    ).rejects.toThrow(/no connection/i)
  })

  it('drops the half-open flow when consent was refused', async () => {
    const server = stubOAuthServer()
    const url = await startConnect(SERVER_BASE_URL)

    let thrown: unknown
    try {
      await completeConnect(server.consent(url, 'access_denied'))
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(OAuthProtocolError)
    expect((thrown as OAuthProtocolError).code).toBe('access_denied')
    expect(server.chrome.local.items.pendingConnect).toBeUndefined()
    expect(server.tokenRequests).toEqual([])
  })

  it('keeps waiting when a callback carries a state it did not send', async () => {
    const server = stubOAuthServer()
    await startConnect(SERVER_BASE_URL)

    await expect(
      completeConnect(`${CALLBACK_URL}?code=abc&state=forged`)
    ).rejects.toThrow(/state/i)

    // Somebody else's redirect is no reason to forget the one still open.
    expect(server.chrome.local.items.pendingConnect).toBeDefined()
  })
})

const TOKEN_URL = `${SERVER_BASE_URL}/oauth/token`
const REVOKE_URL = `${SERVER_BASE_URL}/oauth/revoke`

/**
 * Every timeout the code asks `AbortSignal.timeout` for, recorded, with each
 * cut to a few milliseconds so a test does not sit through it.
 */
function shortenTimeouts(): number[] {
  const asked: number[] = []
  const timeout = AbortSignal.timeout.bind(AbortSignal)
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    asked.push(ms)
    return timeout(5)
  })
  return asked
}

function neverAnswers(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal
    signal?.addEventListener('abort', () => {
      reject(signal.reason as Error)
    })
  })
}

/** A connection already in storage, with the access token still good. */
function connected(overrides: Record<string, unknown> = {}) {
  return {
    baseUrl: SERVER_BASE_URL,
    clientId: REGISTERED_CLIENT_ID,
    accessToken: 'pso_stored',
    refreshToken: 'refresh-stored',
    expiresAt: Date.now() + 60 * 60 * 1000,
    ...overrides,
  }
}

describe('getAccessToken', () => {
  it('hands back the stored token without asking the server', async () => {
    const server = stubOAuthServer(connected())

    expect(await getAccessToken()).toBe('pso_stored')
    expect(server.tokenRequests).toEqual([])
  })

  it('refreshes a token that is about to expire and stores the rotated pair', async () => {
    // Inside the skew, so it is treated as spent even though it has not
    // strictly expired: a call made with it could land after it dies.
    const server = stubOAuthServer(
      connected({ expiresAt: Date.now() + 10 * 1000 })
    )
    server.answerTokenWith(() =>
      tokenResponse({ access_token: 'pso_fresh', refresh_token: 'refresh-2' })
    )

    expect(await getAccessToken()).toBe('pso_fresh')

    expect(server.tokenRequests).toEqual([
      {
        grant_type: 'refresh_token',
        refresh_token: 'refresh-stored',
        client_id: REGISTERED_CLIENT_ID,
        resource: RESOURCE,
      },
    ])
    // Rotation is mandatory server-side: the response that returned this one
    // killed the old one, so failing to store it breaks the next refresh.
    expect(server.chrome.local.items).toMatchObject({
      accessToken: 'pso_fresh',
      refreshToken: 'refresh-2',
    })
    expect(server.chrome.local.items.expiresAt).toBeGreaterThan(Date.now())
  })

  it('asks for consent again when nothing is stored', async () => {
    stubOAuthServer()

    await expect(getAccessToken()).rejects.toBeInstanceOf(
      ReauthorizationRequiredError
    )
  })

  it('drops the dead grant and asks for consent again on invalid_grant', async () => {
    const server = stubOAuthServer({
      ...connected({ expiresAt: Date.now() - 1000 }),
      selectedTagIds: ['tag-1'],
    })
    server.answerTokenWith(() => oauthErrorResponse('invalid_grant'))

    await expect(getAccessToken()).rejects.toBeInstanceOf(
      ReauthorizationRequiredError
    )

    expect(server.chrome.local.items.accessToken).toBeUndefined()
    expect(server.chrome.local.items.refreshToken).toBeUndefined()
    // The user's tag picks are not a credential, and they survive so a
    // reconnect does not start from an empty list.
    expect(server.chrome.local.items.selectedTagIds).toEqual(['tag-1'])
  })

  // The server stays, so every open options page can tell a grant the server
  // dropped from a Disconnect, and offer to reconnect to the same server.
  it('remembers the server whose grant was dropped', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))
    server.answerTokenWith(() => oauthErrorResponse('invalid_grant'))

    await expect(getAccessToken()).rejects.toThrow()

    expect(server.chrome.local.items.baseUrl).toBe(SERVER_BASE_URL)
  })

  it('asks for consent again, not as a disconnect, once another context lost the grant', async () => {
    stubOAuthServer({ baseUrl: SERVER_BASE_URL })

    await expect(getAccessToken()).rejects.toMatchObject({
      name: 'ReauthorizationRequiredError',
    })
  })

  // Two refreshes of the same token means one loses the rotation race, and a
  // replay outside the server's short grace window revokes the grant.
  it('posts one refresh when two callers want a token at once', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))

    const [one, other] = await Promise.all([getAccessToken(), getAccessToken()])

    expect(server.tokenRequests).toHaveLength(1)
    expect(one).toBe('pso_access')
    expect(other).toBe('pso_access')
  })

  // The options page and the service worker each load their own copy of this
  // module, sharing only storage. Like the real server, the stub lets one
  // refresh of a token win and answers the other invalid_grant.
  it('keeps the connection when the options page and the worker refresh at once', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))
    const spent = new Set<string>()
    let issued = 0
    server.answerTokenWith(form => {
      if (spent.has(form.refresh_token)) {
        return oauthErrorResponse('invalid_grant')
      }
      spent.add(form.refresh_token)
      issued += 1
      return tokenResponse({
        access_token: `pso_fresh-${issued}`,
        refresh_token: `refresh-${issued + 1}`,
      })
    })
    vi.resetModules()
    const optionsPage = await import('./auth.ts')
    vi.resetModules()
    const worker = await import('./auth.ts')

    const [one, other] = await Promise.all([
      optionsPage.getAccessToken(),
      worker.getAccessToken(),
    ])

    expect(one).toBe('pso_fresh-1')
    expect(other).toBe('pso_fresh-1')
    expect(server.chrome.local.items).toMatchObject({
      accessToken: 'pso_fresh-1',
      refreshToken: 'refresh-2',
    })
  })
})

const TAGS_URL = `${SERVER_BASE_URL}/api/v1/tags`

describe('a request the server never answers', () => {
  it('fails a refresh with a clear error and lets the next one through', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))
    const timeouts = shortenTimeouts()
    let hang = true
    server.fetched.route(TOKEN_URL, (_url, init) =>
      hang ? neverAnswers(init) : tokenResponse()
    )

    await expect(getAccessToken()).rejects.toThrow(
      `${TOKEN_URL} did not answer within 20 seconds`
    )
    expect(new Set(timeouts)).toEqual(new Set([20_000]))
    // The refresh token was never spent, so the connection is still good.
    expect(server.chrome.local.items.refreshToken).toBe('refresh-stored')

    hang = false
    expect(await getAccessToken()).toBe('pso_access')
  })

  it('fails an API call with a clear error', async () => {
    const server = stubOAuthServer(connected())
    shortenTimeouts()
    server.fetched.route(TAGS_URL, (_url, init) => neverAnswers(init))

    await expect(authorizedFetch(TAGS_URL)).rejects.toThrow(
      `${TAGS_URL} did not answer within 20 seconds`
    )
  })

  it('still clears storage when the revocation never answers', async () => {
    const server = stubOAuthServer(connected())
    shortenTimeouts()
    server.fetched.route(REVOKE_URL, (_url, init) => neverAnswers(init))

    await disconnect()

    expect(server.chrome.local.items).toEqual({})
  })
})

describe('authorizedFetch', () => {
  it('sends the access token as a bearer credential', async () => {
    const server = stubOAuthServer(connected())
    const sent: (string | null)[] = []
    server.fetched.route(TAGS_URL, (_url, init) => {
      sent.push(new Headers(init?.headers).get('Authorization'))
      return jsonResponse({ tags: [] })
    })

    const response = await authorizedFetch(TAGS_URL)

    expect(response.status).toBe(200)
    expect(sent).toEqual(['Bearer pso_stored'])
  })

  // The token can die between the expiry check and the call - a clock skew, or
  // a grant revoked from the profile page mid-sync.
  it('refreshes once and retries once when the resource answers 401', async () => {
    const server = stubOAuthServer(connected())
    server.answerTokenWith(() =>
      tokenResponse({ access_token: 'pso_fresh', refresh_token: 'refresh-2' })
    )
    const sent: (string | null)[] = []
    server.fetched.route(TAGS_URL, (_url, init) => {
      const authorization = new Headers(init?.headers).get('Authorization')
      sent.push(authorization)
      return authorization === 'Bearer pso_fresh'
        ? jsonResponse({ tags: [] })
        : new Response(null, { status: 401 })
    })

    const response = await authorizedFetch(TAGS_URL)

    expect(response.status).toBe(200)
    expect(sent).toEqual(['Bearer pso_stored', 'Bearer pso_fresh'])
    expect(server.tokenRequests).toHaveLength(1)
  })

  it('hands back a 401 that survives the refresh rather than looping', async () => {
    const server = stubOAuthServer(connected())
    server.fetched.route(TAGS_URL, () => new Response(null, { status: 401 }))

    const response = await authorizedFetch(TAGS_URL)

    expect(response.status).toBe(401)
    expect(server.tokenRequests).toHaveLength(1)
  })
})

describe('disconnect', () => {
  it('hands the refresh token back and clears everything it stored', async () => {
    const server = stubOAuthServer({
      ...connected(),
      selectedTagIds: ['tag-1'],
      registeredClients: { [SERVER_BASE_URL]: REGISTERED_CLIENT_ID },
    })

    await disconnect()

    // A refresh token takes its grant with it server-side, so this is what
    // makes the access token stop working too.
    expect(server.revocations).toEqual([
      {
        token: 'refresh-stored',
        token_type_hint: 'refresh_token',
        client_id: REGISTERED_CLIENT_ID,
      },
    ])
    expect(server.chrome.local.items).toEqual({})
  })

  it('clears local storage even when the server cannot be reached', async () => {
    const server = stubOAuthServer(connected())
    server.fetched.route(REVOKE_URL, () => {
      throw new Error('offline')
    })

    await disconnect()

    expect(server.chrome.local.items).toEqual({})
  })

  it('clears local storage even when the server refuses the revocation', async () => {
    const server = stubOAuthServer(connected({ clientId: 'dcr_other' }))

    await disconnect()

    expect(server.revocations).toHaveLength(1)
    expect(server.chrome.local.items).toEqual({})
  })

  // The worker can be mid-refresh when the user clicks Disconnect. The pair it
  // is about to store is the live one, so that is the one to revoke, and
  // nothing may be stored once Disconnect has cleared.
  it('waits for a refresh already sent, revokes the pair it got, and keeps nothing', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))
    let answer = () => {}
    const answered = new Promise<void>(resolve => {
      answer = resolve
    })
    server.fetched.route(TOKEN_URL, async () => {
      await answered
      return tokenResponse({
        access_token: 'pso_fresh',
        refresh_token: 'refresh-2',
      })
    })

    const refreshing = getAccessToken()
    await vi.waitFor(() => {
      expect(server.fetched.urls).toContain(TOKEN_URL)
    })
    const disconnecting = disconnect()
    await new Promise(resolve => setTimeout(resolve, 10))
    answer()
    await Promise.allSettled([refreshing, disconnecting])

    expect(server.revocations.map(form => form.token)).toEqual(['refresh-2'])
    expect(server.chrome.local.items).toEqual({})
  })

  // The user chose to end the connection, so a call that finds it gone is
  // not a grant the server dropped and gets no reconnect notice.
  it('ends a refresh queued behind it as not connected, sending nothing', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))
    let answer = () => {}
    const answered = new Promise<void>(resolve => {
      answer = resolve
    })
    server.fetched.route(REVOKE_URL, async () => {
      await answered
      return new Response(null, { status: 200 })
    })

    const disconnecting = disconnect()
    await vi.waitFor(() => {
      expect(server.fetched.urls).toContain(REVOKE_URL)
    })
    const refreshing = getAccessToken()
    answer()
    await disconnecting

    await expect(refreshing).rejects.toMatchObject({
      name: 'NotConnectedError',
    })
    expect(server.tokenRequests).toEqual([])
  })

  it('does nothing to revoke when there is no connection to end', async () => {
    const server = stubOAuthServer()

    await disconnect()

    expect(server.revocations).toEqual([])
  })
})
