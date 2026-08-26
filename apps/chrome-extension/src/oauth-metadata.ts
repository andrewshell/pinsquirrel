/**
 * OAuth discovery: the two documents that turn a base URL into a set of
 * endpoints.
 *
 * Nothing here hardcodes `/oauth/authorize`, `/oauth/token` or `/oauth/revoke`.
 * The one path this file writes out is the RFC 9728 well-known location of the
 * `/api/v1` protected-resource document, because that is the entry point -
 * everything else is read out of a document. A server that moves an endpoint
 * moves it for this client too, without a release.
 *
 * The resource identifier comes out of the document as well, rather than being
 * assembled as `<baseUrl>/api/v1` here. The audience check compares strings
 * (Decision 15), so taking the server's own spelling of it is the only way to
 * be sure the `resource` parameter matches what a token gets bound to.
 */

/**
 * RFC 9728 3.1: the resource's path is appended to the well-known prefix. The
 * resource this extension wants is always `<baseUrl>/api/v1` (Decision 16 -
 * the `/mcp` resource is a different audience and its tokens are refused
 * here), so the path is fixed.
 */
const PROTECTED_RESOURCE_PATH =
  '/.well-known/oauth-protected-resource/api/v1' as const

/**
 * RFC 8414 inserts an issuer's path component between the well-known prefix
 * and the rest; PinSquirrel's issuer is a bare origin (`BASE_URL`), and the
 * server serves this document at the root only, so the plain path is what it
 * answers.
 */
const AUTHORIZATION_SERVER_PATH =
  '/.well-known/oauth-authorization-server' as const

/** Where a client goes for each step of the flow, all discovered. */
export interface OAuthEndpoints {
  /** The `resource` parameter to send, and the audience tokens are bound to. */
  resource: string
  /** The authorization server's identity, checked against the `iss` on a redirect. */
  issuer: string
  authorizationEndpoint: string
  tokenEndpoint: string
  /** RFC 7591 dynamic registration, which is how this extension gets a `client_id`. */
  registrationEndpoint: string
  /** RFC 7009, where `disconnect()` hands the refresh token back. */
  revocationEndpoint: string
}

/** A document that could not be read, named so a failure says which one. */
export class DiscoveryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DiscoveryError'
  }
}

/** `https://host/` and `https://host` name the same origin; keep one spelling. */
function withoutTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

async function fetchDocument(
  url: string,
  what: string
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(url)
  } catch (cause) {
    throw new DiscoveryError(`Could not reach the ${what} at ${url}`, { cause })
  }

  if (!response.ok) {
    throw new DiscoveryError(
      `The ${what} at ${url} answered ${response.status}`
    )
  }

  try {
    return (await response.json()) as Record<string, unknown>
  } catch (cause) {
    throw new DiscoveryError(`The ${what} at ${url} is not JSON`, { cause })
  }
}

function requireString(
  document: Record<string, unknown>,
  field: string,
  what: string
): string {
  const value = document[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new DiscoveryError(`The ${what} has no ${field}`)
  }
  return value
}

/**
 * Read both documents and return every endpoint the flow needs.
 *
 * The protected-resource document names its authorization servers; the first
 * entry is the one used, which is what the server's own comment says every
 * client does and what it publishes for.
 */
export async function discoverEndpoints(
  baseUrl: string
): Promise<OAuthEndpoints> {
  const origin = withoutTrailingSlash(baseUrl)

  const resourceDocument = await fetchDocument(
    `${origin}${PROTECTED_RESOURCE_PATH}`,
    'protected-resource metadata document'
  )
  const resource = requireString(
    resourceDocument,
    'resource',
    'protected-resource metadata document'
  )

  const servers = resourceDocument.authorization_servers
  if (!Array.isArray(servers) || typeof servers[0] !== 'string') {
    throw new DiscoveryError(
      'The protected-resource metadata document names no authorization server'
    )
  }
  const issuer = withoutTrailingSlash(servers[0])

  const what = 'authorization-server metadata document'
  const serverDocument = await fetchDocument(
    `${issuer}${AUTHORIZATION_SERVER_PATH}`,
    what
  )

  return {
    resource,
    issuer: requireString(serverDocument, 'issuer', what),
    authorizationEndpoint: requireString(
      serverDocument,
      'authorization_endpoint',
      what
    ),
    tokenEndpoint: requireString(serverDocument, 'token_endpoint', what),
    registrationEndpoint: requireString(
      serverDocument,
      'registration_endpoint',
      what
    ),
    revocationEndpoint: requireString(
      serverDocument,
      'revocation_endpoint',
      what
    ),
  }
}
