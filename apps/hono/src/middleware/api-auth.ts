import type { Context, MiddlewareHandler } from 'hono'
import type { ApiKey, User } from '@pinsquirrel/domain'
import { authenticateBearer } from './bearer-auth.js'
import { bearerChallenge } from './www-authenticate.js'
import type { ProtectedResourceConfig } from '../lib/config.js'

interface ApiAuthVariables {
  apiUser: User
  apiKey: ApiKey
}

declare module 'hono' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ContextVariableMap extends ApiAuthVariables {}
}

/**
 * `resource` is the REST API's own protected-resource identifier. It is not the
 * MCP one: a token minted for `/mcp` must not open `/api/v1` (Decision 17), and
 * advertising the wrong metadata document sends the client after the wrong
 * audience.
 */
export function apiKeyAuth(
  resource: ProtectedResourceConfig
): MiddlewareHandler {
  const challenge = bearerChallenge(resource)

  return async (c, next) => {
    const result = await authenticateBearer(c, { allowApiKeyHeader: true })
    if (!result.ok) {
      return c.json({ error: result.failure.message }, 401, {
        'WWW-Authenticate': challenge,
      })
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
