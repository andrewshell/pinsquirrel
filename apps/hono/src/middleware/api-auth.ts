import type { Context, MiddlewareHandler } from 'hono'
import type { ApiKey, User } from '@pinsquirrel/domain'
import { apiKeyService } from '../lib/services'
import { userRepository } from '../lib/db'

interface ApiAuthVariables {
  apiUser: User
  apiKey: ApiKey
}

declare module 'hono' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends ApiAuthVariables {}
}

function extractRawKey(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
    if (match) return match[1].trim()
  }
  const xApiKey = c.req.header('X-API-Key')
  if (xApiKey) return xApiKey.trim()
  return null
}

export function apiKeyAuth(): MiddlewareHandler {
  return async (c, next) => {
    const rawKey = extractRawKey(c)
    if (!rawKey) {
      return c.json({ error: 'Missing API key' }, 401)
    }

    const apiKey = await apiKeyService.authenticateByKey(rawKey)
    if (!apiKey) {
      return c.json({ error: 'Invalid API key' }, 401)
    }

    const user = await userRepository.findById(apiKey.userId)
    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    c.set('apiUser', user)
    c.set('apiKey', apiKey)

    await next()
  }
}

export function getApiUser(c: Context): User {
  return c.get('apiUser')
}

export function getApiKey(c: Context): ApiKey {
  return c.get('apiKey')
}
