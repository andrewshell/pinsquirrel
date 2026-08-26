/**
 * URI rules shared by everything OAuth touches.
 *
 * The issuer, the resource identifiers, the `resource` parameter on an
 * authorization request and the audience stored on a token all have to compare
 * as the same string, so they all pass through one normalization here rather
 * than each caller deciding what a trailing slash means.
 *
 * Phase 6c extends this file with redirect-URI matching and the loopback
 * port-agnostic rule; 6a needs only normalization and the RFC 9728 path
 * transform.
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
