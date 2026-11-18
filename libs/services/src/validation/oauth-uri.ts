/**
 * URI rules shared by everything OAuth touches.
 *
 * The issuer, the resource identifiers, the `resource` parameter on an
 * authorization request and the audience stored on a token all have to compare
 * as the same string, so they all pass through one normalization here rather
 * than each caller deciding what a trailing slash means.
 *
 * Redirect URIs are the exception: they are compared as strings
 * (`redirectUriMatches`), and canonicalized only for the DCR dedup key.
 */

const WELL_KNOWN_PROTECTED_RESOURCE = '/.well-known/oauth-protected-resource'

/**
 * Canonical form of an issuer or resource identifier: lowercase scheme and
 * host, no default port, no trailing slash, no fragment.
 *
 * Throws if the string is not an absolute URI, because a relative one can
 * never be an identifier.
 */
export function normalizeOAuthUri(uri: string): string {
  const trimmed = typeof uri === 'string' ? uri.trim() : ''
  if (!trimmed) {
    throw new Error('OAuth URI must be a non-empty absolute URI')
  }

  let url: URL
  try {
    // WHATWG parsing already lowercases the scheme and host and drops the
    // default port for the scheme.
    url = new URL(trimmed)
  } catch {
    throw new Error(`OAuth URI must be an absolute URI: ${trimmed}`)
  }

  url.hash = ''
  const path = url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname

  return `${url.protocol}//${url.host}${path}${url.search}`
}

/**
 * The path a protected resource publishes its metadata at (RFC 9728 3.1):
 * `/.well-known/oauth-protected-resource` with the resource's own path
 * appended, so `https://example.com/api/v1` publishes at
 * `/.well-known/oauth-protected-resource/api/v1`.
 *
 * Both the route that serves the document and the `WWW-Authenticate` challenge
 * that advertises it derive the path from here, so they cannot drift. A drift
 * is silent: the client 404s on discovery and gives up.
 */
export function protectedResourceMetadataPath(resource: string): string {
  const url = new URL(normalizeOAuthUri(resource))
  const path = url.pathname === '/' ? '' : url.pathname
  return `${WELL_KNOWN_PROTECTED_RESOURCE}${path}`
}

/**
 * Is this the host a native client listens on?
 *
 * `localhost`, anything in `127.0.0.0/8`, and `::1` (bracketed, as `URL`
 * reports it). RFC 8252 7.3 names all three, and only these three: a name
 * that merely ends in `localhost` is somebody else's host.
 */
export function isLoopbackRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost') return true
  if (host === '[::1]' || host === '::1') return true
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
}

/**
 * The form of a redirect URI the DCR dedup key is built from.
 *
 * Normalized like every other OAuth URI, and with the port dropped when the
 * host is loopback. Claude Code registers a fresh ephemeral port on every
 * connection (RFC 8252 7.3), so byte-equal metadata comparison would store one
 * client row per connection, which is the exact thing dedup exists to
 * prevent. Every other host keeps its port. This is a dedup key only; a
 * request's `redirect_uri` is compared by `redirectUriMatches`.
 */
export function canonicalizeRedirectUri(uri: string): string {
  const normalized = normalizeOAuthUri(uri)
  const url = new URL(normalized)
  if (!url.port || !isLoopbackRedirectHost(url.hostname)) {
    return normalized
  }
  url.port = ''
  const path = url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname
  return `${url.protocol}//${url.host}${path}${url.search}`
}

/**
 * The scheme and host of a loopback redirect, and its port if it has one.
 *
 * Matched on the raw string: `localhost`, `127.x.x.x` or `[::1]`, written
 * exactly so, straight after `http://`. A userinfo part, an upper-case host or
 * anything else `URL` parsing would tidy away is not a loopback authority here
 * and so gets no port allowance.
 */
const LOOPBACK_AUTHORITY =
  /^(http:\/\/(?:localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[::1\]))(?::\d{1,5})?(?=[/?]|$)/

function withoutLoopbackPort(uri: string): string {
  return uri.replace(LOOPBACK_AUTHORITY, '$1')
}

/**
 * Does a request's `redirect_uri` match one the client registered?
 *
 * Simple string comparison (RFC 9700 4.1.3), with one allowance: on a
 * loopback redirect the port may differ (RFC 8252 7.3). A native client is
 * handed an ephemeral port when it starts listening, long after it published
 * `http://localhost/callback`, so the port cannot be part of what identifies
 * it. Everything else, path and query included, has to be byte-equal: a
 * trailing slash, userinfo, a fragment or a dot segment can each send the
 * browser somewhere the client did not register, even on the same host.
 *
 * Hosts are never treated as equivalent to each other: `localhost` and
 * `127.0.0.1` are different registrations, which is why Claude Code publishes
 * both.
 */
export function redirectUriMatches(
  registered: string,
  requested: string
): boolean {
  if (registered === requested) return true
  return (
    LOOPBACK_AUTHORITY.test(registered) &&
    withoutLoopbackPort(registered) === withoutLoopbackPort(requested)
  )
}
