import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authorizedFetch,
  buildAuthorizationUrl,
  connect,
  getAccessToken,
  OAuthProtocolError,
  ReauthorizationRequiredError,
  readAuthorizationRedirect,
} from './auth.ts'
import type { OAuthEndpoints } from './oauth-metadata.ts'
import { pkceChallengeFor } from './pkce.ts'
import { STUB_REDIRECT_URL } from './test/chrome-mock.ts'
import { jsonResponse } from './test/fetch-mock.ts'
import {
  BASE_URL as SERVER_BASE_URL,
  oauthErrorResponse,
  REGISTERED_CLIENT_ID,
  RESOURCE,
  stubOAuthServer,
  tokenResponse,
} from './test/oauth-server.ts'

afterEach(() => {
  vi.unstubAllGlobals()
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

describe('connect', () => {
  it('registers, gets consent, and stores the tokens the exchange returned', async () => {
    const server = stubOAuthServer()

    await connect(SERVER_BASE_URL)

    // Registered as a public client at the callback Chrome minted for it.
    expect(server.registrations).toEqual([
      {
        client_name: 'PinSquirrel Chrome Extension',
        redirect_uris: [STUB_REDIRECT_URL],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
      },
    ])

    expect(server.chrome.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: true })
    )

    expect(server.tokenRequests).toEqual([
      {
        grant_type: 'authorization_code',
        code: 'code-1',
        redirect_uri: STUB_REDIRECT_URL,
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
  })

  it('proves it started the flow: the verifier it sends hashes to the challenge it sent', async () => {
    const server = stubOAuthServer()

    await connect(SERVER_BASE_URL)

    const challenge =
      server.authorizations[0].searchParams.get('code_challenge')
    const verifier = server.tokenRequests[0].code_verifier

    expect(challenge).toBe(await pkceChallengeFor(verifier))
  })

  it('reuses a cached registration rather than registering again', async () => {
    const server = stubOAuthServer({
      registeredClients: { [SERVER_BASE_URL]: 'dcr_cached' },
    })

    await connect(SERVER_BASE_URL)

    expect(server.registrations).toEqual([])
    expect(server.tokenRequests[0].client_id).toBe('dcr_cached')
  })

  it('re-registers and starts over when the server has forgotten the cached client', async () => {
    const server = stubOAuthServer({
      registeredClients: { [SERVER_BASE_URL]: 'dcr_stale' },
    })
    server.answerTokenWith(form =>
      form.client_id === 'dcr_stale'
        ? oauthErrorResponse('invalid_client', 401)
        : tokenResponse()
    )

    await connect(SERVER_BASE_URL)

    expect(server.registrations).toHaveLength(1)
    expect(server.authorizations).toHaveLength(2)
    expect(server.chrome.local.items).toMatchObject({
      clientId: REGISTERED_CLIENT_ID,
      registeredClients: { [SERVER_BASE_URL]: REGISTERED_CLIENT_ID },
    })
  })
})

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

  // Two refreshes of the same token means one loses the rotation race, and the
  // server revokes the whole grant family for a replay.
  it('posts one refresh when two callers want a token at once', async () => {
    const server = stubOAuthServer(connected({ expiresAt: Date.now() - 1000 }))

    const [one, other] = await Promise.all([getAccessToken(), getAccessToken()])

    expect(server.tokenRequests).toHaveLength(1)
    expect(one).toBe('pso_access')
    expect(other).toBe('pso_access')
  })
})

const TAGS_URL = `${SERVER_BASE_URL}/api/v1/tags`

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
