import type { Context } from 'hono'
import type { ApiKey, User } from '@pinsquirrel/domain'
import { apiKeyService } from '../lib/services.js'

export interface AuthenticatedRequest {
  user: User
  apiKey: ApiKey
  rawKey: string
}

export type AuthFailure =
  | { reason: 'missing'; message: 'Missing API key' }
  | { reason: 'invalid'; message: 'Invalid API key' }
  | { reason: 'invalid_header'; message: 'Invalid Authorization header' }

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
 * Header parsing stays here because it is transport; resolving the token to a
 * principal is ApiKeyService's job. Callers (REST middleware, MCP middleware)
 * decide how to render the failure as an HTTP response and what context
 * variables to set on success.
 */
export async function authenticateBearer(
  c: Context,
  options: { allowApiKeyHeader: boolean } = { allowApiKeyHeader: true }
): Promise<
  { ok: true; auth: AuthenticatedRequest } | { ok: false; failure: AuthFailure }
> {
  const extracted = extractRawKey(c, options)
  if ('failure' in extracted) return { ok: false, failure: extracted.failure }

  // One call: the service resolves the key and the account behind it. A key
  // whose owner has gone is reported as invalid rather than as a missing user,
  // so the response never confirms that the key itself was good.
  const authenticated = await apiKeyService.authenticate(extracted.rawKey)
  if (!authenticated) {
    return {
      ok: false,
      failure: { reason: 'invalid', message: 'Invalid API key' },
    }
  }

  return {
    ok: true,
    auth: { ...authenticated, rawKey: extracted.rawKey },
  }
}
