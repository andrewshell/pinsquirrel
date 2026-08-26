import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizationUrl,
  connect,
  OAuthProtocolError,
  readAuthorizationRedirect,
} from './auth.ts'
import type { OAuthEndpoints } from './oauth-metadata.ts'
import { pkceChallengeFor } from './pkce.ts'
import { STUB_REDIRECT_URL } from './test/chrome-mock.ts'
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
