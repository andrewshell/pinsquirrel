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
export function bearerChallenge(resource: ProtectedResourceConfig): string {
  const params = [
    `resource_metadata="${resource.metadataUrl}"`,
    `scope="${resource.scopes.join(' ')}"`,
  ]
  return `Bearer ${params.join(', ')}`
}
