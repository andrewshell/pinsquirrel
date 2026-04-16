import type { MiddlewareHandler } from 'hono'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { apiKeyService } from '../lib/services.js'
import { userRepository } from '../lib/db.js'

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthInfo
  }
}

export function mcpAuth(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) {
      return c.json({ error: 'Missing API key' }, 401)
    }

    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
    if (!match) {
      return c.json({ error: 'Invalid Authorization header' }, 401)
    }

    const rawKey = match[1].trim()
    const apiKey = await apiKeyService.authenticateByKey(rawKey)
    if (!apiKey) {
      return c.json({ error: 'Invalid API key' }, 401)
    }

    const user = await userRepository.findById(apiKey.userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    c.set('auth', {
      token: rawKey,
      clientId: user.id,
      scopes: [],
      extra: { user },
    })

    await next()
  }
}
