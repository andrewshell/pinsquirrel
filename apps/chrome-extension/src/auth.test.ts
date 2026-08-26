import { describe, expect, it } from 'vitest'
import {
  buildAuthorizationUrl,
  OAuthProtocolError,
  readAuthorizationRedirect,
} from './auth.ts'
import type { OAuthEndpoints } from './oauth-metadata.ts'

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
