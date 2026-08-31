import type { Context, MiddlewareHandler } from 'hono'
import type { User } from '@pinsquirrel/domain'
import { oauthService } from '../lib/services.js'
import { bearerChallenge } from './www-authenticate.js'
import type { ProtectedResourceConfig } from '../lib/config.js'

/**
 * Bearer authentication for the OAuth protected resources.
 *
 * Header parsing stays here because it is transport, and resolving the token
 * to a principal is `OAuthService.verifyAccessToken`'s job - the hash lookup,
 * the expiry and revocation checks, the audience check and the user lookup all
 * happen there.
 *
 * There is deliberately no dispatch between credential types: an OAuth access
 * token in `Authorization: Bearer` is the only credential this server accepts
 * (Decision 10). No other header carries one.
 */

/** Who a verified OAuth access token turns out to be. */
export interface OAuthPrincipal {
  user: User
  /** The OAuth client the token was issued to, not the user id. */
  clientId: string
  scopes: string[]
  /** The token as presented, for callers that have to pass it on (MCP). */
  rawToken: string
  /**
   * The protected resource the token was accepted for. Carried so a later
   * guard - `requireScope` - can phrase its refusal against the same resource
   * that authenticated the request, rather than picking one out of the config
   * and risking naming the other one's metadata document (Decision 16).
   */
  resource: ProtectedResourceConfig
}

interface OAuthAuthVariables {
  // Set by oauthAuth() only. Routes behind it read it with getOAuthUser() /
  // getOAuthPrincipal(), which is why it is not typed as non-optional.
  oauthPrincipal: OAuthPrincipal | undefined
}

declare module 'hono' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends OAuthAuthVariables {}
}

type Failure = { error: 'invalid_token'; error_description: string }

const MISSING: Failure = {
  error: 'invalid_token',
  error_description: 'An OAuth bearer token is required',
}

const MALFORMED: Failure = {
  error: 'invalid_token',
  error_description: 'The Authorization header must be a Bearer token',
}

const INVALID: Failure = {
  error: 'invalid_token',
  error_description: 'The access token is invalid, expired, or revoked',
}

function extractBearerToken(c: Context): string | Failure {
  const header = c.req.header('Authorization')
  if (!header) return MISSING

  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return MALFORMED

  const raw = match[1].trim()
  return raw === '' ? MALFORMED : raw
}

/**
 * `resource` is the protected-resource identifier this route is. It is a
 * parameter rather than a module-level constant so neither `/mcp` nor
 * `/api/v1` can inherit the other's audience (Decision 16): the service checks
 * the token against exactly this string, and the 401 advertises exactly this
 * resource's metadata document.
 */
export function oauthAuth(
  resource: ProtectedResourceConfig
): MiddlewareHandler {
  const challenge = bearerChallenge(resource)

  const unauthorized = (c: Context, failure: Failure) =>
    c.json(failure, 401, { 'WWW-Authenticate': challenge })

  return async (c, next) => {
    const extracted = extractBearerToken(c)
    if (typeof extracted !== 'string') {
      return unauthorized(c, extracted)
    }

    const verified = await oauthService.verifyAccessToken(
      extracted,
      resource.resource
    )
    if (!verified) {
      return unauthorized(c, INVALID)
    }

    c.set('oauthPrincipal', {
      user: verified.user,
      clientId: verified.clientId,
      scopes: verified.scopes,
      rawToken: extracted,
      resource,
    })
    await next()
  }
}

/**
 * Require one granted scope on the route behind it.
 *
 * Applied per route and never globally (Decision 20): the check belongs to the
 * operation, so a read-only token keeps reading everything while a write is
 * refused. Mounted globally it would either lock the reads behind a write
 * scope or, applied to nothing, be decorative.
 *
 * 403 rather than 401, because the token is valid and re-presenting or
 * refreshing it changes nothing. What the client has to do is send the user
 * back through `/oauth/authorize` naming the wider scope, and the
 * `insufficient_scope` challenge naming that scope is the entire signal it
 * gets - there is no server-side upgrade path.
 */
export function requireScope(scope: string): MiddlewareHandler {
  return async (c, next) => {
    const principal = getOAuthPrincipal(c)
    if (!principal.scopes.includes(scope)) {
      return c.json(
        {
          error: 'insufficient_scope',
          error_description: `This request requires the ${scope} scope`,
        },
        403,
        {
          'WWW-Authenticate': bearerChallenge(principal.resource, {
            error: 'insufficient_scope',
            scope,
          }),
        }
      )
    }
    await next()
  }
}

/**
 * The principal for a route mounted behind `oauthAuth()`.
 *
 * Non-null by construction: the middleware answers 401 rather than calling the
 * handler when no principal resolves. Throws if called from a route that is
 * not behind the middleware, which is a wiring mistake rather than a runtime
 * condition to handle.
 */
export function getOAuthPrincipal(c: Context): OAuthPrincipal {
  const principal = c.get('oauthPrincipal')
  if (!principal) {
    throw new Error(
      'getOAuthPrincipal() called on a route that is not behind oauthAuth()'
    )
  }
  return principal
}

export function getOAuthUser(c: Context): User {
  return getOAuthPrincipal(c).user
}
