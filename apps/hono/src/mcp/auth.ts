import type { MiddlewareHandler } from 'hono'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { oauthAuth, getOAuthPrincipal } from '../middleware/oauth-auth.js'
import type { ProtectedResourceConfig } from '../lib/config.js'

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthInfo
  }
}

/**
 * `resource` is the protected resource this endpoint is: its metadata document
 * is what the 401 advertises, and it is the audience a token has to be bound
 * to. Passing it in rather than reading config here keeps the middleware
 * transport-only and makes the challenge testable.
 *
 * The credential is an OAuth access token. `oauthAuth` does the parsing and
 * the 401 - including the challenge, which clients need on every request
 * including tool calls, because they authenticate lazily - and this wrapper
 * translates the principal into the SDK's `AuthInfo`. The two types stay
 * distinct on purpose (Decision 10): `AuthInfo` is the SDK's shape, built
 * from ours.
 */
export function mcpAuth(resource: ProtectedResourceConfig): MiddlewareHandler {
  const authenticate = oauthAuth(resource)

  return async (c, next) =>
    authenticate(c, async () => {
      const principal = getOAuthPrincipal(c)
      c.set('auth', {
        token: principal.rawToken,
        // The OAuth client, not the user it acts for, and the scopes the
        // grant actually carries rather than an empty array.
        clientId: principal.clientId,
        scopes: principal.scopes,
        extra: { user: principal.user },
      })
      await next()
    })
}
