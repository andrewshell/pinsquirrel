import { Hono } from 'hono'
import type { Context } from 'hono'
import { OAuthError, ValidationError } from '@pinsquirrel/domain'
import { oauthService } from '../lib/services.js'
import { describeValidationError } from '../lib/oauth-error.js'
import {
  oauthTokenClientLimiter,
  oauthTokenIpLimiter,
  rateLimitByClientId,
  rateLimitByIp,
} from '../middleware/rate-limit.js'

/**
 * The RFC 6749 token endpoint and the RFC 7009 revocation endpoint.
 *
 * Both are machine-facing and both are mounted before `csrf()`, next to
 * `/mcp`: the caller is an OAuth client posting from its own process, not a
 * browser form, and there is no session to protect. Neither reads a
 * repository; every check lives in `OAuthService` (Decision 18).
 *
 * `application/x-www-form-urlencoded` is the only body form here. Claude sends
 * the initial exchange and every refresh that way, and RFC 6749 4.1.3
 * specifies nothing else. `/oauth/register` is the JSON one; the two do not
 * share a parser.
 *
 * Both are rate limited per IP, and the token endpoint additionally per
 * `client_id`: a public client refreshes from whatever address its user is on,
 * so the address alone bounds nothing for it. A refusal is a plain `429` with
 * `Retry-After` rather than an RFC 6749 error object, because every code in
 * that registry describes something wrong with the request, and a client told
 * `invalid_request` would fix its request instead of waiting.
 */

const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded'

/** RFC 6749 5.1: token responses must never be cached. */
const NO_STORE = { 'Cache-Control': 'no-store' } as const

function isFormEncoded(c: Context): boolean {
  const contentType = c.req.header('Content-Type') ?? ''
  return contentType.split(';')[0].trim().toLowerCase() === FORM_CONTENT_TYPE
}

/**
 * The posted form as plain strings.
 *
 * `parseBody()` yields `string | File` per field; a File is not a protocol
 * parameter, so dropping it here means the schemas reject a missing field
 * rather than a wrongly typed one.
 */
async function formParams(c: Context): Promise<Record<string, string>> {
  const body = await c.req.parseBody()
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') params[key] = value
  }
  return params
}

function errorResponse(c: Context, error: string, description: string) {
  // RFC 6749 5.2: invalid_client is the one 401 here, because it is a failure
  // to authenticate rather than a malformed request.
  const status = error === 'invalid_client' ? 401 : 400
  return c.json(
    { error, error_description: description },
    status,
    NO_STORE as Record<string, string>
  )
}

const oauthToken = new Hono()

const TOO_MANY_REQUESTS =
  'Too many token requests. Please try again later.' as const

// Revocation shares the per-IP budget: it is the same unauthenticated surface,
// and a caller grinding it is doing so to find out which tokens exist.
oauthToken.use('*', rateLimitByIp(oauthTokenIpLimiter, TOO_MANY_REQUESTS))
oauthToken.use(
  '/token',
  rateLimitByClientId(oauthTokenClientLimiter, TOO_MANY_REQUESTS)
)

oauthToken.post('/token', async c => {
  if (!isFormEncoded(c)) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: `The token endpoint accepts ${FORM_CONTENT_TYPE} only`,
      },
      415,
      NO_STORE as Record<string, string>
    )
  }

  const params = await formParams(c)

  try {
    // Dispatch on the grant type, then hand the raw parameters to the
    // service: the schemas parse the wire format as it arrived, so nothing
    // here has to agree on a second spelling of the same request.
    const issued =
      params.grant_type === 'authorization_code'
        ? await oauthService.exchangeAuthorizationCode(params)
        : params.grant_type === 'refresh_token'
          ? await oauthService.exchangeRefreshToken(params)
          : null

    if (!issued) {
      return errorResponse(
        c,
        'unsupported_grant_type',
        `${params.grant_type ?? 'A missing grant_type'} is not a supported grant type`
      )
    }

    return c.json(
      {
        access_token: issued.accessToken,
        token_type: issued.tokenType,
        expires_in: issued.expiresIn,
        // Rotation returns the replacement in the same response that
        // invalidates the old one, so the client is never left without one.
        ...(issued.refreshToken ? { refresh_token: issued.refreshToken } : {}),
        scope: issued.scopes.join(' '),
      },
      200,
      NO_STORE as Record<string, string>
    )
  } catch (error) {
    if (error instanceof OAuthError) {
      // The service names its own code; the transport never invents one.
      return errorResponse(c, error.code, error.message)
    }
    if (error instanceof ValidationError) {
      return errorResponse(c, 'invalid_request', describeValidationError(error))
    }
    throw error
  }
})

/**
 * RFC 7009 revocation, the client-side half of "disconnect".
 *
 * It shares `revokeToken` with the profile page's grant list (Phase 6f): a
 * user revoking from the UI and a client handing its token back are the same
 * operation, and a refresh token takes its whole grant family with it either
 * way.
 *
 * Always 200. An unknown token, an already dead one, and one belonging to
 * another client all answer identically, because reporting which was which
 * would be a way to find out whether a token exists.
 */
oauthToken.post('/revoke', async c => {
  if (!isFormEncoded(c)) {
    return c.json(
      {
        error: 'invalid_request',
        error_description: `The revocation endpoint accepts ${FORM_CONTENT_TYPE} only`,
      },
      415,
      NO_STORE as Record<string, string>
    )
  }

  const params = await formParams(c)

  if (params.token) {
    await oauthService.revokeToken({
      token: params.token,
      ...(params.client_id ? { client_id: params.client_id } : {}),
      ...(params.token_type_hint
        ? { token_type_hint: params.token_type_hint }
        : {}),
    })
  }

  return c.body(null, 200, NO_STORE as Record<string, string>)
})

export { oauthToken as oauthTokenRoutes }
