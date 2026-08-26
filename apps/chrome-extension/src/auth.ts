import type { OAuthEndpoints } from './oauth-metadata.ts'

/**
 * The extension's OAuth 2.1 client.
 *
 * Authorization code with PKCE against a fixed HTTPS callback Chrome mints for
 * the extension (Decision 17), so there is no secret here and no loopback port
 * to match.
 */

/**
 * What the extension asks for.
 *
 * `offline_access` is what buys the refresh token, and without it the service
 * worker would have to reopen a browser tab every hour. The protected-resource
 * document does not advertise it - it is a property of the authorization
 * server, not of `/api/v1` - so it is named here rather than read off the
 * resource's `scopes_supported`.
 */
const SCOPES = 'pins:read tags:read offline_access' as const

/**
 * A failure the server named in RFC 6749 terms, from a redirect or from a
 * token response.
 *
 * The code is kept rather than flattened into the message because the caller
 * branches on it: `invalid_grant` means re-consent, `invalid_client` means the
 * cached registration is stale.
 */
export class OAuthProtocolError extends Error {
  constructor(
    /** One of the RFC 6749 wire codes, e.g. `invalid_grant`. */
    readonly code: string,
    description: string
  ) {
    super(description)
    this.name = 'OAuthProtocolError'
  }
}

/** The authorization request, as a URL for `launchWebAuthFlow` to open. */
export function buildAuthorizationUrl(input: {
  endpoints: OAuthEndpoints
  clientId: string
  redirectUri: string
  challenge: string
  state: string
}): string {
  const url = new URL(input.endpoints.authorizationEndpoint)
  const params = {
    response_type: 'code',
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
    scope: SCOPES,
    state: input.state,
    // RFC 8707. The server requires it: it serves two protected resources
    // whose whole point is that a token for one is refused by the other
    // (Decision 16), so there is no safe default for it to fall back on.
    resource: input.endpoints.resource,
  }
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/** Read the authorization code out of the URL Chrome came back with. */
export function readAuthorizationRedirect(
  redirectUrl: string,
  expected: { state: string; issuer: string }
): string {
  const params = new URL(redirectUrl).searchParams

  // Checked before anything else is read: a redirect this extension did not
  // start has nothing worth looking at, whatever else it carries.
  if (params.get('state') !== expected.state) {
    throw new Error('The authorization redirect carried the wrong state')
  }

  const error = params.get('error')
  if (error) {
    throw new OAuthProtocolError(
      error,
      params.get('error_description') ?? `Authorization failed: ${error}`
    )
  }

  // RFC 9207, which the server advertises and sets on success and on failure.
  // A redirect naming a different issuer is a mix-up attempt, so it is refused
  // even though the state matched.
  const issuer = params.get('iss')
  if (issuer && issuer !== expected.issuer) {
    throw new Error(
      `The authorization redirect names issuer ${issuer}, not ${expected.issuer}`
    )
  }

  const code = params.get('code')
  if (!code) {
    throw new Error('The authorization redirect carried no code')
  }
  return code
}
