import { Hono } from 'hono'
import type { Context } from 'hono'
import { OAuthError, ValidationError } from '@pinsquirrel/domain'
import { oauthService } from '../lib/services.js'
import { describeValidationError } from '../lib/oauth-error.js'
import { oauthTokenIpLimiter, rateLimitByIp } from '../middleware/rate-limit.js'

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
 * Both are rate limited per IP only (Decision 33). A refusal is a plain `429` with
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
// and a caller grinding it is doing so to find out which tokens exist. Named
// routes, not '*': this app mounts at `/oauth` beside the consent screen.
const tokenIpLimit = rateLimitByIp(oauthTokenIpLimiter, TOO_MANY_REQUESTS)
oauthToken.use('/token', tokenIpLimit)
oauthToken.use('/revoke', tokenIpLimit)

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
 * A refresh token takes its grant with it: the access tokens of the same
 * approval, and no other connection of that client. The profile page's Revoke
 * is the wider one, and ends every grant the user gave the client.
 *
 * An unknown or already dead token answers 200, as a revoked one does,
 * because telling them apart would be a way to find out whether a token
 * exists. A request with no token, or with a `client_id` the token was not
 * issued to, is refused.
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

  try {
    await oauthService.revokeToken(await formParams(c))
  } catch (error) {
    if (error instanceof OAuthError) {
      return errorResponse(c, error.code, error.message)
    }
    if (error instanceof ValidationError) {
      return errorResponse(c, 'invalid_request', describeValidationError(error))
    }
    throw error
  }

  return c.body(null, 200, NO_STORE as Record<string, string>)
})

export { oauthToken as oauthTokenRoutes }
