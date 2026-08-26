import type { MiddlewareHandler } from 'hono'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { authenticateBearer } from '../middleware/bearer-auth.js'
import { bearerChallenge } from '../middleware/www-authenticate.js'
import type { ProtectedResourceConfig } from '../lib/config.js'

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthInfo
  }
}

/**
 * `resource` is the protected resource this endpoint is: its metadata document
 * is what the 401 advertises. Passing it in rather than reading config here
 * keeps the middleware transport-only and makes the challenge testable.
 */
export function mcpAuth(resource: ProtectedResourceConfig): MiddlewareHandler {
  const challenge = bearerChallenge(resource)

  return async (c, next) => {
    const result = await authenticateBearer(c, { allowApiKeyHeader: false })
    if (!result.ok) {
      // A real 401 with a real challenge, on every request including tool
      // calls. Clients ignore WWW-Authenticate on a 200 and treat an MCP-level
      // tool error as a tool failure, so either shape leaves them unable to
      // discover where to authenticate.
      return c.json({ error: result.failure.message }, 401, {
        'WWW-Authenticate': challenge,
      })
    }
    c.set('auth', {
      token: result.auth.rawKey,
      clientId: result.auth.user.id,
      scopes: [],
      extra: { user: result.auth.user },
    })
    await next()
  }
}
