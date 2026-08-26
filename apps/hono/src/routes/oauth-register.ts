import { Hono } from 'hono'
import type { Context } from 'hono'
import type { OAuthClient } from '@pinsquirrel/domain'
import { OAuthError, ValidationError } from '@pinsquirrel/domain'
import { oauthService } from '../lib/services.js'
import { describeValidationError } from '../lib/oauth-error.js'
import {
  oauthRegisterLimiter,
  rateLimitByIp,
} from '../middleware/rate-limit.js'

/**
 * RFC 7591 Dynamic Client Registration, the fallback path.
 *
 * CIMD is the preferred one (Decision 13): DCR is deprecated in the current
 * spec and lets an anonymous caller create rows. What bounds the damage lives
 * in the service and the sweep, not here - `registerClient` derives the
 * identifier from a canonicalized copy of the metadata, so re-registering the
 * same client returns the same row, and `MaintenanceService.sweepExpired`
 * removes registrations that never complete an authorization.
 *
 * A per-IP quota bounds it further, and it is the tightest limit in the app:
 * the endpoint is unauthenticated and it creates rows, while a real client
 * registers once per fresh connection. A refusal is a plain `429` with
 * `Retry-After`; RFC 7591 has no error code that means "later".
 *
 * `application/json` only. `/oauth/token` is the form-encoded one; the two do
 * not share a parser.
 */

const JSON_CONTENT_TYPE = 'application/json'

function isJson(c: Context): boolean {
  const contentType = c.req.header('Content-Type') ?? ''
  return contentType.split(';')[0].trim().toLowerCase() === JSON_CONTENT_TYPE
}

/**
 * Every failure here is `invalid_client_metadata` (RFC 7591 3.2.2), including
 * the schema failures the token endpoint would report as `invalid_request`.
 */
function metadataError(c: Context, description: string, status: 400 | 415) {
  return c.json(
    { error: 'invalid_client_metadata', error_description: description },
    status
  )
}

/** The registered client echoed back as RFC 7591 client information. */
function clientInformation(client: OAuthClient) {
  return {
    client_id: client.clientId,
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    ...(client.clientName ? { client_name: client.clientName } : {}),
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    response_types: ['code'],
    // This server registers public clients and advertises nothing else, so
    // there is no secret to return alongside the identifier.
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
  }
}

const oauthRegister = new Hono()

oauthRegister.use(
  '*',
  rateLimitByIp(
    oauthRegisterLimiter,
    'Too many client registrations. Please try again later.'
  )
)

oauthRegister.post('/register', async c => {
  if (!isJson(c)) {
    return metadataError(
      c,
      `The registration endpoint accepts ${JSON_CONTENT_TYPE} only`,
      415
    )
  }

  let metadata: unknown
  try {
    metadata = await c.req.json()
  } catch {
    return metadataError(c, 'The request body is not valid JSON', 400)
  }

  try {
    const client = await oauthService.registerClient(metadata)
    return c.json(clientInformation(client), 201)
  } catch (error) {
    if (error instanceof OAuthError) {
      return metadataError(c, error.message, 400)
    }
    if (error instanceof ValidationError) {
      return metadataError(c, describeValidationError(error), 400)
    }
    throw error
  }
})

export { oauthRegister as oauthRegisterRoutes }
