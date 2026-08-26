import { discoverEndpoints, type OAuthEndpoints } from './oauth-metadata.ts'
import { createPkcePair, randomUrlSafeToken } from './pkce.ts'
import * as storage from './storage.ts'
import type { StoredTokens } from './types.ts'

/**
 * The extension's OAuth 2.1 client.
 *
 * Authorization code with PKCE against a fixed HTTPS callback Chrome mints for
 * the extension (Decision 17), so there is no secret here and no loopback port
 * to match.
 *
 * ## Why dynamic registration rather than CIMD
 *
 * CIMD is this server's preferred path (Decision 13) and it is not available
 * to an extension. A CIMD `client_id` is an HTTPS URL the *client* publishes a
 * metadata document at, which the server fetches; an extension is a bundle of
 * files inside a browser profile with no origin it can serve from, and
 * `chrome-extension://` is not fetchable from a server. Hosting the document
 * on pinsquirrel.com instead would make the authorization server vouch for its
 * own client, which is the check CIMD exists to perform.
 *
 * So the extension registers dynamically (RFC 7591). The cost CIMD avoids - a
 * row per connection - does not apply here, because `registerClient` derives
 * the identifier from the metadata: this extension's name and callback are
 * fixed, so every install of it deduplicates to the same row.
 */

/** The name the consent screen shows the user. */
const CLIENT_NAME = 'PinSquirrel Chrome Extension' as const

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

/**
 * The grant is gone and only the user can bring it back.
 *
 * Distinguishable from every other failure on purpose: a caller that catches
 * this puts the popup back on its Connect button, where a network error or a
 * 500 should leave the connection alone and be retried.
 */
export class ReauthorizationRequiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReauthorizationRequiredError'
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

/** `https://host/` and `https://host` name the same server; keep one spelling. */
function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

/** What the token endpoint answers with (RFC 6749 5.1). */
interface TokenResponseBody {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope: string
}

/** The RFC 6749 5.2 error body, which both machine endpoints answer with. */
function protocolErrorFrom(body: unknown, status: number): OAuthProtocolError {
  const fields = (body ?? {}) as Record<string, unknown>
  const code = typeof fields.error === 'string' ? fields.error : 'server_error'
  const description =
    typeof fields.error_description === 'string'
      ? fields.error_description
      : `The server answered ${status}`
  return new OAuthProtocolError(code, description)
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Post to the token endpoint.
 *
 * `application/x-www-form-urlencoded` is the only body form it accepts; the
 * registration endpoint is the JSON one.
 */
async function postTokenRequest(
  endpoint: string,
  params: Record<string, string>
): Promise<TokenResponseBody> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  })

  const body = await readJson(response)
  if (!response.ok) throw protocolErrorFrom(body, response.status)
  return body as TokenResponseBody
}

/** The token response as the extension stores it, with expiry made absolute. */
function tokensFrom(
  body: TokenResponseBody,
  context: { baseUrl: string; clientId: string; previousRefreshToken?: string }
): StoredTokens {
  const refreshToken = body.refresh_token ?? context.previousRefreshToken
  if (!refreshToken) {
    // Without one the service worker cannot refresh unattended, which is the
    // whole reason `offline_access` is requested. Failing here beats
    // discovering it an hour later with no way to recover but a consent screen.
    throw new Error('The token response carried no refresh token')
  }

  return {
    baseUrl: context.baseUrl,
    clientId: context.clientId,
    accessToken: body.access_token,
    refreshToken,
    expiresAt: Date.now() + body.expires_in * 1000,
  }
}

/**
 * Register this extension as a public client (RFC 7591).
 *
 * The identifier the server returns is derived from this metadata rather than
 * generated, so posting the same body twice returns the same client instead of
 * creating a second one.
 */
async function registerClient(
  endpoints: OAuthEndpoints,
  redirectUri: string
): Promise<string> {
  const response = await fetch(endpoints.registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: CLIENT_NAME,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      // This server registers public clients only and advertises no other
      // method. An extension has nowhere to keep a secret anyway.
      token_endpoint_auth_method: 'none',
    }),
  })

  const body = await readJson(response)
  if (!response.ok) throw protocolErrorFrom(body, response.status)

  const clientId = (body as { client_id?: unknown }).client_id
  if (typeof clientId !== 'string' || clientId.length === 0) {
    throw new Error('The registration response carried no client_id')
  }
  return clientId
}

/**
 * The `client_id` for this server, registering one if there is none cached.
 *
 * The cache is keyed by base URL so a user who connects to a self-hosted
 * PinSquirrel and to pinsquirrel.com does not overwrite one registration with
 * the other.
 */
async function resolveClientId(
  baseUrl: string,
  endpoints: OAuthEndpoints,
  redirectUri: string
): Promise<string> {
  const cached = (await storage.get('registeredClients')) ?? {}
  if (cached[baseUrl]) return cached[baseUrl]

  const clientId = await registerClient(endpoints, redirectUri)
  await storage.set({ registeredClients: { ...cached, [baseUrl]: clientId } })
  return clientId
}

/** Forget a cached registration the server no longer recognises. */
async function forgetClientId(baseUrl: string): Promise<void> {
  const cached = { ...((await storage.get('registeredClients')) ?? {}) }
  delete cached[baseUrl]
  await storage.set({ registeredClients: cached })
}

/**
 * One consent round trip: open the flow, come back with a code, spend it.
 *
 * Every value that binds the two halves together - the verifier, the state,
 * the redirect URI - is created here and never leaves the call, so two
 * concurrent connects cannot pick up each other's.
 */
async function authorizeAndExchange(input: {
  baseUrl: string
  endpoints: OAuthEndpoints
  clientId: string
  redirectUri: string
}): Promise<StoredTokens> {
  const { verifier, challenge } = await createPkcePair()
  const state = randomUrlSafeToken()

  const redirect = await chrome.identity.launchWebAuthFlow({
    url: buildAuthorizationUrl({
      endpoints: input.endpoints,
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      challenge,
      state,
    }),
    // The user has to see the consent screen and sign in if they are not
    // already, so there is no non-interactive form of this.
    interactive: true,
  })

  if (!redirect) {
    throw new Error('The authorization window closed without a redirect')
  }

  const code = readAuthorizationRedirect(redirect, {
    state,
    issuer: input.endpoints.issuer,
  })

  const body = await postTokenRequest(input.endpoints.tokenEndpoint, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: verifier,
    resource: input.endpoints.resource,
  })

  return tokensFrom(body, {
    baseUrl: input.baseUrl,
    clientId: input.clientId,
  })
}

/**
 * Connect the extension to a PinSquirrel server: discover, register, get the
 * user's consent, and store what comes back.
 *
 * A cached registration the server has since forgotten answers the exchange
 * with `invalid_client`. That is recoverable, but only by starting over - the
 * code was spent on the way in - so the cache is dropped and the whole flow
 * runs once more against a fresh registration.
 */
export async function connect(baseUrl: string): Promise<void> {
  const origin = normalizeBaseUrl(baseUrl)
  const endpoints = await discoverEndpoints(origin)
  const redirectUri = chrome.identity.getRedirectURL()

  const attempt = async (clientId: string) =>
    authorizeAndExchange({ baseUrl: origin, endpoints, clientId, redirectUri })

  let tokens: StoredTokens
  try {
    tokens = await attempt(
      await resolveClientId(origin, endpoints, redirectUri)
    )
  } catch (error) {
    if (!(
      error instanceof OAuthProtocolError && error.code === 'invalid_client'
    )) {
      throw error
    }
    await forgetClientId(origin)
    tokens = await attempt(
      await resolveClientId(origin, endpoints, redirectUri)
    )
  }

  await storage.set(tokens)
}

/**
 * The keys that make up a connection, read together so a half-written state
 * cannot look like a whole one.
 */
const TOKEN_KEYS = [
  'baseUrl',
  'clientId',
  'accessToken',
  'refreshToken',
  'expiresAt',
] as const

/** The stored connection, or nothing if the extension is not connected. */
async function storedTokens(): Promise<StoredTokens | null> {
  const stored = await storage.getMany([...TOKEN_KEYS])
  for (const key of TOKEN_KEYS) {
    if (stored[key] === undefined) return null
  }
  return stored as StoredTokens
}

/**
 * How close to expiry an access token is treated as already spent.
 *
 * A token that dies while a request is in flight comes back as a 401 the
 * caller has to unwind, so it is cheaper to refresh a minute early than to
 * discover the expiry mid-call.
 */
const EXPIRY_SKEW_MS = 60 * 1000

function isSpent(tokens: StoredTokens): boolean {
  return tokens.expiresAt - Date.now() <= EXPIRY_SKEW_MS
}

/**
 * The one refresh allowed to be in flight.
 *
 * Rotation is mandatory server-side and a rotated token is a replay: two
 * concurrent refreshes of the same token means one of them loses the race and
 * the *whole grant* is revoked. The popup and the service worker can both want
 * a token at once, so they share this promise rather than each posting.
 */
let refreshInFlight: Promise<StoredTokens> | null = null

/**
 * Spend the refresh token for a new pair, and store what comes back.
 *
 * The endpoints are rediscovered rather than cached across calls: a service
 * worker is torn down between wakes, so a cache would rarely survive to be
 * used, and a stale one would send a refresh to an endpoint the server has
 * moved.
 */
async function refreshTokens(current: StoredTokens): Promise<StoredTokens> {
  refreshInFlight ??= (async () => {
    try {
      const endpoints = await discoverEndpoints(current.baseUrl)
      const body = await postTokenRequest(endpoints.tokenEndpoint, {
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: current.clientId,
        resource: endpoints.resource,
      })

      const next = tokensFrom(body, {
        baseUrl: current.baseUrl,
        clientId: current.clientId,
        previousRefreshToken: current.refreshToken,
      })
      await storage.set(next)
      return next
    } catch (error) {
      if (
        error instanceof OAuthProtocolError &&
        error.code === 'invalid_grant'
      ) {
        // Expired, revoked from the profile page, or replayed - the server
        // took the whole family either way. Nothing here can recover it.
        await storage.remove([...TOKEN_KEYS])
        throw new ReauthorizationRequiredError(error.message)
      }
      throw error
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

/**
 * A bearer token good for the next call.
 *
 * Refreshes when the stored one is spent or nearly so; the caller never has to
 * ask whether it is still valid.
 */
export async function getAccessToken(): Promise<string> {
  const tokens = await storedTokens()
  if (!tokens) {
    throw new ReauthorizationRequiredError(
      'The extension is not connected to a PinSquirrel server'
    )
  }
  if (!isSpent(tokens)) return tokens.accessToken

  return (await refreshTokens(tokens)).accessToken
}

/**
 * A token to retry a rejected call with, or null if there is nothing to retry.
 *
 * Takes the token that was rejected, because a concurrent caller may have
 * refreshed already: refreshing again would spend a token that was never used,
 * and the extra rotation is pure risk for no gain.
 */
async function refreshedTokenAfter(rejected: string): Promise<string | null> {
  const tokens = await storedTokens()
  if (!tokens) return null
  if (tokens.accessToken !== rejected) return tokens.accessToken
  return (await refreshTokens(tokens)).accessToken
}

/**
 * `fetch`, with the connection's bearer token on it.
 *
 * This is the seam the API client sits on (Phase 5c): it never sees a token,
 * an expiry or a refresh, only a `Response`.
 *
 * A `401` buys exactly one refresh and one retry. The expiry check should have
 * caught a spent token already, so a `401` means something the clock did not
 * predict - a revoked grant, a skewed clock - and a second one means refreshing
 * is not the answer, so it is returned rather than retried into a loop.
 *
 * The retry replays `init` as given, which is safe for the read-only v1 API
 * (Decision 6) but would not be for a streamed request body.
 */
export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const send = (token: string) => {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  }

  const token = await getAccessToken()
  const response = await send(token)
  if (response.status !== 401) return response

  const retryToken = await refreshedTokenAfter(token)
  if (!retryToken) return response
  return send(retryToken)
}
