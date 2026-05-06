import type { MiddlewareHandler } from 'hono'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { authenticateBearer } from '../middleware/bearer-auth.js'

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthInfo
  }
}

export function mcpAuth(): MiddlewareHandler {
  return async (c, next) => {
    const result = await authenticateBearer(c, { allowApiKeyHeader: false })
    if (!result.ok) {
      return c.json({ error: result.failure.message }, 401)
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
