import type { Context, MiddlewareHandler } from 'hono'
import type { ApiKey, User } from '@pinsquirrel/domain'
import { authenticateBearer } from './bearer-auth.js'

interface ApiAuthVariables {
  apiUser: User
  apiKey: ApiKey
}

declare module 'hono' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends ApiAuthVariables {}
}

export function apiKeyAuth(): MiddlewareHandler {
  return async (c, next) => {
    const result = await authenticateBearer(c, { allowApiKeyHeader: true })
    if (!result.ok) {
      return c.json({ error: result.failure.message }, 401)
    }
    c.set('apiUser', result.auth.user)
    c.set('apiKey', result.auth.apiKey)
    await next()
  }
}

export function getApiUser(c: Context): User {
  return c.get('apiUser')
}

export function getApiKey(c: Context): ApiKey {
  return c.get('apiKey')
}
