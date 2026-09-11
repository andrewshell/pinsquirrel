import { discoverEndpoints, type OAuthEndpoints } from './oauth-metadata.ts'
import { createPkcePair, randomUrlSafeToken } from './pkce.ts'
import * as storage from './storage.ts'
import type { PendingConnect, StoredTokens } from './types.ts'

/**
 * The extension's OAuth 2.1 client.
 *
 * Authorization code with PKCE, with the consent screen in an ordinary browser
 * tab and a page on the server itself as the redirect URI
 * (`/oauth/extension/callback`). Chrome's `launchWebAuthFlow` window was the
 * first design (Decision 17); it forbids other extensions, so a password
 * manager could not fill the sign-in form inside it. The worker watches the
 * tab instead and reads the code off the callback URL, which needs the host
 * permission the pin flow already relies on. There is no secret here and no
 * loopback port to match.
 *
 * The flow is two calls with a tab in between - `startConnect` and
 * `completeConnect` - rather than one, because the worker that opens the tab
 * is not the worker that hears the answer: MV3 unloads it while the user reads
 * the consent screen, so everything the second half needs is in storage.
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
 * this puts the options page back on its Connect button, where a network error or a
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

/** The page on the server the consent screen sends the browser back to. */
export const EXTENSION_CALLBACK_PATH = '/oauth/extension/callback' as const

/** The redirect URI registered for `baseUrl`: the callback page on it. */
export function extensionRedirectUri(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}${EXTENSION_CALLBACK_PATH}`
}

/** What `completeConnect` answers when it did not simply finish. */
export type ConnectOutcome =
  | { status: 'connected' }
  /**
   * The exchange failed with `invalid_client`: the cached registration is one
   * the server has forgotten, and the code is spent. A fresh registration has
   * been made and this is the consent URL for it, for the worker to send the
   * same tab to.
   */
  | { status: 'restart'; url: string }

/**
 * Start a connection to `baseUrl`: discover, register, and build the consent
 * URL for the worker to open in a tab.
 *
 * Everything the other half needs - verifier, state, client, endpoints - is
 * written to storage as `pendingConnect` before the URL is handed back, so an
 * answer that arrives after the worker has been unloaded still finds it. A
 * second start overwrites the first: the newer tab is the one being watched.
 */
export async function startConnect(baseUrl: string): Promise<string> {
  const origin = normalizeBaseUrl(baseUrl)
  const endpoints = await discoverEndpoints(origin)
  const redirectUri = extensionRedirectUri(origin)
  const clientId = await resolveClientId(origin, endpoints, redirectUri)
  return beginAuthorization({
    baseUrl: origin,
    endpoints,
    clientId,
    redirectUri,
  })
}

async function beginAuthorization(pending: {
  baseUrl: string
  endpoints: OAuthEndpoints
  clientId: string
  redirectUri: string
}): Promise<string> {
  const { verifier, challenge } = await createPkcePair()
  const state = randomUrlSafeToken()

  await storage.set({
    pendingConnect: { ...pending, state, verifier },
  })

  return buildAuthorizationUrl({
    endpoints: pending.endpoints,
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    challenge,
    state,
  })
}

/**
 * Finish the connection the consent tab landed on `redirectUrl` for: check it
 * is the answer to the flow in storage, spend the code, store the tokens.
 *
 * A redirect carrying a state this flow did not send is refused and the flow
 * is left open - it is somebody else's, or a stale tab, and neither is a
 * reason to forget the one still waiting. Every other failure closes the
 * flow: a refusal, a bad token response, and `invalid_client`, which is the
 * one recoverable case and comes back as a `restart` rather than an error.
 */
export async function completeConnect(
  redirectUrl: string
): Promise<ConnectOutcome> {
  const pending = await storage.get('pendingConnect')
  if (pending === undefined) {
    throw new Error('No connection is in progress')
  }

  let code: string
  try {
    code = readAuthorizationRedirect(redirectUrl, {
      state: pending.state,
      issuer: pending.endpoints.issuer,
    })
  } catch (error) {
    // A refusal is the server's answer to this flow, so the flow is over. A
    // wrong state is not an answer to this flow at all, so it stays open.
    if (error instanceof OAuthProtocolError) {
      await storage.remove(['pendingConnect'])
    }
    throw error
  }

  try {
    const tokens = await exchangeCode(pending, code)
    await storage.set(tokens)
    await storage.remove(['pendingConnect'])
    return { status: 'connected' }
  } catch (error) {
    if (
      error instanceof OAuthProtocolError &&
      error.code === 'invalid_client'
    ) {
      await forgetClientId(pending.baseUrl)
      const clientId = await resolveClientId(
        pending.baseUrl,
        pending.endpoints,
        pending.redirectUri
      )
      return {
        status: 'restart',
        url: await beginAuthorization({ ...pending, clientId }),
      }
    }
    await storage.remove(['pendingConnect'])
    throw error
  }
}

/** Forget a flow that will never be answered: its tab was closed. */
export async function cancelConnect(): Promise<void> {
  await storage.remove(['pendingConnect'])
}

async function exchangeCode(
  pending: PendingConnect,
  code: string
): Promise<StoredTokens> {
  const body = await postTokenRequest(pending.endpoints.tokenEndpoint, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: pending.redirectUri,
    client_id: pending.clientId,
    code_verifier: pending.verifier,
    resource: pending.endpoints.resource,
  })

  return tokensFrom(body, {
    baseUrl: pending.baseUrl,
    clientId: pending.clientId,
  })
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
 * the *whole grant* is revoked. The options page and the service worker can both want
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

/**
 * End the connection: hand the refresh token back, then forget everything.
 *
 * The refresh token is the one worth revoking. Server-side it stands for the
 * whole grant, so revoking it kills the access tokens minted from it too;
 * revoking the access token alone would leave the refresh token able to mint
 * more.
 *
 * The local clear happens whichever way the revocation goes. A user who
 * clicked Disconnect while offline must not be left connected, and the server
 * sweeps an abandoned grant on its own. That includes the cached registration,
 * which costs one idempotent re-registration on the next connect and rules out
 * reconnecting against a `client_id` the server has since forgotten.
 */
export async function disconnect(): Promise<void> {
  const tokens = await storedTokens()

  if (tokens) {
    try {
      const endpoints = await discoverEndpoints(tokens.baseUrl)
      await fetch(endpoints.revocationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: tokens.refreshToken,
          token_type_hint: 'refresh_token',
          client_id: tokens.clientId,
        }).toString(),
      })
    } catch {
      // RFC 7009 answers 200 for an unknown or already-dead token, so the only
      // failures here are transport ones, and none of them is a reason to
      // leave a disconnected extension holding credentials.
    }
  }

  await storage.clear()
}
