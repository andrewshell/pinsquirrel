/**
 * URI rules shared by everything OAuth touches.
 *
 * The issuer, the resource identifiers, the `resource` parameter on an
 * authorization request and the audience stored on a token all have to compare
 * as the same string, so they all pass through one normalization here rather
 * than each caller deciding what a trailing slash means.
 *
 * Phase 6c added redirect-URI matching and the loopback port-agnostic rule on
 * top of the normalization and RFC 9728 path transform 6a needed.
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
 * The form of a redirect URI that two of them are compared by.
 *
 * Normalized like every other OAuth URI, and with the port dropped when the
 * host is loopback. A native client is handed an ephemeral port by the
 * operating system at the moment it starts listening, long after it published
 * the portless `http://localhost/callback` in its metadata, so the port cannot
 * be part of what identifies the URI (RFC 8252 7.3). Every other host keeps
 * its port: for a hosted client the port is as much a part of the address as
 * the hostname, and ignoring it would widen an exact match into a wildcard.
 *
 * The same canonical form is the DCR dedup key, for the same reason. Claude
 * Code registers a fresh ephemeral port on every connection, so byte-equal
 * metadata comparison would store one client row per connection, which is the
 * exact thing dedup exists to prevent.
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
 * Does a request's `redirect_uri` match one the client registered?
 *
 * Exact on the canonical form, which means exact for a hosted callback and
 * port-agnostic for a loopback one. Hosts are never treated as equivalent to
 * each other: `localhost` and `127.0.0.1` are different registrations, which
 * is why Claude Code publishes both.
 *
 * A URI that will not parse is not a match rather than an exception. This is
 * called with attacker-controlled input on every authorization request, and
 * "no match" is already the right answer for it.
 */
export function redirectUriMatches(
  registered: string,
  requested: string
): boolean {
  try {
    return (
      canonicalizeRedirectUri(registered) === canonicalizeRedirectUri(requested)
    )
  } catch {
    return false
  }
}

/**
 * The registered URI a request matched, or null if none did.
 *
 * The registered value is what gets stored on the authorization code and
 * repeated at the token exchange, so the caller needs the entry back rather
 * than a boolean.
 */
export function matchRedirectUri(
  registered: string[],
  requested: string
): string | null {
  return registered.find(uri => redirectUriMatches(uri, requested)) ?? null
}
