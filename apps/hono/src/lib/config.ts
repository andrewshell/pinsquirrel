import {
  normalizeOAuthUri,
  protectedResourceMetadataPath,
} from '@pinsquirrel/services'

/**
 * Deployment facts read once, here, and passed down.
 *
 * Nothing below the app reads `process.env`: services receive their
 * configuration the way `MailgunEmailService` does. `routes/seo.ts` derives its
 * origin from the request, which is fine for a sitemap and wrong for OAuth -
 * the issuer, the resource identifiers and the audience check all have to agree
 * on one string that a spoofed `Host` header cannot influence (Decision 20).
 */

const DEV_BASE_URL = 'http://localhost:8100'

/**
 * Scopes both protected resources advertise. `offline_access` is deliberately
 * absent: it is a property of the authorization server, not of a resource, so
 * it appears only in the RFC 8414 document.
 */
export const OAUTH_RESOURCE_SCOPES = ['pins:read', 'tags:read'] as const

export interface ProtectedResourceConfig {
  /** The resource identifier a token must be audience-bound to. */
  resource: string
  /** RFC 9728 path this resource's metadata document is served at. */
  metadataPath: string
  /** Absolute URL of that document, as advertised in `WWW-Authenticate`. */
  metadataUrl: string
  scopes: readonly string[]
}

export interface OAuthConfig {
  issuer: string
  resources: {
    mcp: ProtectedResourceConfig
    apiV1: ProtectedResourceConfig
  }
}

/**
 * Resolve the one origin the app claims to be. Required in production, because
 * getting it wrong there means signing an identity nobody can verify; defaulted
 * in development, where there is no TLS and the port is fixed.
 */
export function resolveBaseUrl(env: NodeJS.ProcessEnv): string {
  const configured = env.BASE_URL?.trim()
  if (configured) return normalizeOAuthUri(configured)

  if (env.NODE_ENV === 'production') {
    throw new Error(
      'BASE_URL must be set in production. It is the OAuth issuer and the ' +
        'origin of every resource identifier, e.g. https://pinsquirrel.com'
    )
  }

  return DEV_BASE_URL
}

function protectedResource(
  baseUrl: string,
  path: string
): ProtectedResourceConfig {
  const resource = normalizeOAuthUri(`${baseUrl}${path}`)
  const metadataPath = protectedResourceMetadataPath(resource)
  return {
    resource,
    metadataPath,
    metadataUrl: `${baseUrl}${metadataPath}`,
    scopes: OAUTH_RESOURCE_SCOPES,
  }
}

export function createOAuthConfig(baseUrl: string): OAuthConfig {
  const issuer = normalizeOAuthUri(baseUrl)
  return {
    issuer,
    resources: {
      // Two resources, one authorization server. The identifiers stay distinct
      // so a token minted for `/mcp` is rejected by `/api/v1` and vice versa
      // (Decision 17, Decision 18).
      mcp: protectedResource(issuer, '/mcp'),
      apiV1: protectedResource(issuer, '/api/v1'),
    },
  }
}

export const baseUrl = resolveBaseUrl(process.env)
export const oauthConfig = createOAuthConfig(baseUrl)
