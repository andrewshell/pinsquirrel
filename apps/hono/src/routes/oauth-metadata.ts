import { Hono } from 'hono'
import type { OAuthConfig, ProtectedResourceConfig } from '../lib/config.js'

/**
 * OAuth discovery documents: one RFC 9728 protected-resource document per
 * resource, plus the RFC 8414 authorization-server document.
 *
 * Every URL is derived from the configured base URL and never from the
 * request, so a spoofed `Host` header cannot change the identity the server
 * publishes (Decision 20). The routes are mounted before session and CSRF
 * middleware because a client has to read them while it is still anonymous.
 */

/**
 * `offline_access` belongs to the authorization server only. Claude appends it
 * to an authorization request only when the AS document advertises it, and
 * without it the connection dies at the first access-token expiry. A protected
 * resource SHOULD NOT list it, because refresh is not a resource requirement.
 */
const AS_ONLY_SCOPES = ['offline_access'] as const

function protectedResourceDocument(
  issuer: string,
  resource: ProtectedResourceConfig
) {
  return {
    resource: resource.resource,
    // Claude uses the first entry only and never falls back to later ones.
    authorization_servers: [issuer],
    scopes_supported: [...resource.scopes],
  }
}

export function createOAuthMetadataRoutes(config: OAuthConfig): Hono {
  const routes = new Hono()

  for (const resource of [config.resources.mcp, config.resources.apiV1]) {
    // RFC 9728 3.1 decides this path from the resource identifier, so it is
    // derived rather than written out. Hand-writing it is a silent failure:
    // the client 404s on discovery and gives up.
    routes.get(resource.metadataPath, c =>
      c.json(protectedResourceDocument(config.issuer, resource))
    )
  }

  routes.get('/.well-known/oauth-authorization-server', c =>
    c.json({
      issuer: config.issuer,
      authorization_endpoint: `${config.issuer}/oauth/authorize`,
      token_endpoint: `${config.issuer}/oauth/token`,
      registration_endpoint: `${config.issuer}/oauth/register`,
      // RFC 7009. Advertised now that the endpoint exists: a client with
      // nowhere to hand a token back keeps it until it expires.
      revocation_endpoint: `${config.issuer}/oauth/revoke`,
      scopes_supported: [...config.resources.mcp.scopes, ...AS_ONLY_SCOPES],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      // Claude selects CIMD only when both of the next two are advertised: the
      // CIMD client authenticates as a public client. Miss either and it
      // silently falls back to DCR.
      client_id_metadata_document_supported: true,
      token_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: true,
    })
  )

  return routes
}
