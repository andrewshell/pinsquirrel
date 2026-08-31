import type { ProtectedResourceConfig } from '../lib/config.js'

/**
 * The `WWW-Authenticate` challenge a protected resource returns with its 401.
 *
 * This is the entire discovery handshake from the client's point of view: the
 * 401 tells it where to read the resource's metadata, the metadata names the
 * authorization server, and the flow proceeds from there. Without the header a
 * client has nothing to go on and simply reports that it cannot connect.
 *
 * Two things the status has to get right, both of which clients depend on:
 * it must be a real HTTP 401 (a 200 carrying an error body is ignored), and it
 * must be returned for unauthenticated tool calls too, not only for the first
 * connect - that is the spec's "lazy authentication".
 */
export interface BearerChallengeOptions {
  /** An RFC 6750 error code, e.g. `insufficient_scope`. */
  error?: string
  /**
   * The scope this particular request needed, replacing the resource's
   * advertised list. RFC 6750 3.1 asks an `insufficient_scope` challenge to
   * name what was missing, and a client told "everything on offer" learns
   * nothing about which scope to re-authorize for.
   */
  scope?: string
}

/**
 * `options` is what makes one function serve both the 401 and the 403. The
 * resource stays in the challenge either way, so the discovery handshake
 * still works from a scope refusal, and both protected resources phrase the
 * refusal identically rather than each inventing a header.
 */
export function bearerChallenge(
  resource: ProtectedResourceConfig,
  options: BearerChallengeOptions = {}
): string {
  const params = []
  if (options.error) params.push(`error="${options.error}"`)
  params.push(`resource_metadata="${resource.metadataUrl}"`)
  params.push(`scope="${options.scope ?? resource.scopes.join(' ')}"`)
  return `Bearer ${params.join(', ')}`
}
