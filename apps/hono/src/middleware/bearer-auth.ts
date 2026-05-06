import type { Context } from 'hono'
import type { ApiKey, User } from '@pinsquirrel/domain'
import { apiKeyService } from '../lib/services.js'
import { userRepository } from '../lib/db.js'

export interface AuthenticatedRequest {
  user: User
  apiKey: ApiKey
  rawKey: string
}

export type AuthFailure =
  | { reason: 'missing'; message: 'Missing API key' }
  | { reason: 'invalid'; message: 'Invalid API key' }
  | { reason: 'invalid_header'; message: 'Invalid Authorization header' }
  | { reason: 'no_user'; message: 'User not found' }

function extractRawKey(
  c: Context,
  options: { allowApiKeyHeader: boolean }
): { rawKey: string } | { failure: AuthFailure } {
  const authHeader = c.req.header('Authorization')
  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim())
    if (match) return { rawKey: match[1].trim() }
    if (!options.allowApiKeyHeader) {
      return {
        failure: {
          reason: 'invalid_header',
          message: 'Invalid Authorization header',
        },
      }
    }
  }
  if (options.allowApiKeyHeader) {
    const xApiKey = c.req.header('X-API-Key')
    if (xApiKey) return { rawKey: xApiKey.trim() }
  }
  return { failure: { reason: 'missing', message: 'Missing API key' } }
}

/**
 * Authenticate a request via API key (Bearer token, optionally `X-API-Key`).
 *
 * Returns the resolved `User` and `ApiKey` on success, or a structured
 * `AuthFailure` describing what went wrong. Callers (REST middleware,
 * MCP middleware) decide how to render the failure as an HTTP response
 * and what context variables to set on success.
 */
export async function authenticateBearer(
  c: Context,
  options: { allowApiKeyHeader: boolean } = { allowApiKeyHeader: true }
): Promise<
  { ok: true; auth: AuthenticatedRequest } | { ok: false; failure: AuthFailure }
> {
  const extracted = extractRawKey(c, options)
  if ('failure' in extracted) return { ok: false, failure: extracted.failure }

  const apiKey = await apiKeyService.authenticateByKey(extracted.rawKey)
  if (!apiKey) {
    return {
      ok: false,
      failure: { reason: 'invalid', message: 'Invalid API key' },
    }
  }

  const user = await userRepository.findById(apiKey.userId)
  if (!user) {
    return {
      ok: false,
      failure: { reason: 'no_user', message: 'User not found' },
    }
  }

  return { ok: true, auth: { user, apiKey, rawKey: extracted.rawKey } }
}
