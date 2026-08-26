import { OAuthClientMetadataSchema } from '@modelcontextprotocol/sdk/shared/auth.js'
import { z } from 'zod'
import { isLoopbackRedirectHost } from './oauth-uri.js'

/**
 * The OAuth wire formats, validated in the shape they arrive in.
 *
 * Field names stay snake_case on purpose: these schemas parse a query string,
 * a form body and a JSON document exactly as the client sent them, so the
 * route hands its raw parameters straight to the service and nothing has to
 * agree on a second, camelCase spelling of the same request.
 *
 * The RFC 7591 client metadata comes from `@modelcontextprotocol/sdk`, which
 * publishes it framework-agnostically (Decision 14). Only the parts this
 * server needs to be stricter about are re-stated here.
 */

/**
 * RFC 7636 4.1: 43-128 characters from the unreserved set. Applied to both
 * the challenge and the verifier, which are the same alphabet.
 */
const pkceValue = z
  .string()
  .min(43)
  .max(128)
  .regex(/^[A-Za-z0-9\-._~]+$/, 'must be a PKCE value')

/**
 * The authorization request, as it arrives on `/oauth/authorize`.
 *
 * `code_challenge_method` is required and must be `S256`. RFC 7636 reads an
 * absent method as `plain`, which OAuth 2.1 forbids and the server metadata
 * never advertised, so there is nothing to accept it as.
 *
 * `resource` is required, which RFC 8707 leaves optional. This server has two
 * protected resources whose whole point is that a token for one is refused by
 * the other (Decision 17), so a request that names neither has no safe default
 * to fall back on.
 */
export const authorizationRequestSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1),
  redirect_uri: z.string().min(1),
  code_challenge: pkceValue,
  code_challenge_method: z.literal('S256'),
  scope: z.string().optional(),
  state: z.string().optional(),
  resource: z.string().min(1),
})

export type AuthorizationRequestParams = z.infer<
  typeof authorizationRequestSchema
>

/** `grant_type=authorization_code` on `/oauth/token`. */
export const authorizationCodeGrantSchema = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  redirect_uri: z.string().min(1),
  client_id: z.string().min(1),
  code_verifier: pkceValue,
  resource: z.string().min(1).optional(),
})

export type AuthorizationCodeGrantParams = z.infer<
  typeof authorizationCodeGrantSchema
>

/** `grant_type=refresh_token` on `/oauth/token`. */
export const refreshTokenGrantSchema = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().min(1),
  client_id: z.string().min(1),
  scope: z.string().optional(),
  resource: z.string().min(1).optional(),
})

export type RefreshTokenGrantParams = z.infer<typeof refreshTokenGrantSchema>

/**
 * Either grant. The token endpoint dispatches on `grant_type`, so anything
 * else is `unsupported_grant_type` rather than a malformed request.
 */
export const tokenRequestSchema = z.discriminatedUnion('grant_type', [
  authorizationCodeGrantSchema,
  refreshTokenGrantSchema,
])

export type TokenRequestParams = z.infer<typeof tokenRequestSchema>

/**
 * The RFC 7591 registration body posted to `/oauth/register`.
 *
 * The SDK schema allows an empty `redirect_uris`; this server does not, since
 * a client with nowhere to send the user cannot complete an authorization and
 * the row would only ever be swept.
 */
export const clientRegistrationSchema = OAuthClientMetadataSchema.refine(
  metadata => metadata.redirect_uris.length > 0,
  { message: 'at least one redirect_uri is required', path: ['redirect_uris'] }
)

export type ClientRegistrationMetadata = z.infer<
  typeof clientRegistrationSchema
>

/**
 * A Client ID Metadata Document (Decision 15): the same metadata, published by
 * the client at an HTTPS URL, plus the `client_id` that URL names.
 *
 * The `client_id` is required because comparing it against the URL the
 * document was fetched from is the check that makes CIMD safe. A document that
 * omits it could be any client's.
 */
export const clientIdMetadataDocumentSchema = OAuthClientMetadataSchema.extend({
  client_id: z.string().min(1),
}).refine(metadata => metadata.redirect_uris.length > 0, {
  message: 'at least one redirect_uri is required',
  path: ['redirect_uris'],
})

export type ClientIdMetadataDocument = z.infer<
  typeof clientIdMetadataDocumentSchema
>

/**
 * A redirect URI this server is willing to send a browser to: https, or http
 * on a loopback host. Same rule the registration path applies, stated here so
 * an operator's typo fails at boot rather than at the first consent screen.
 */
function isUsableRedirectUri(uri: string): boolean {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && isLoopbackRedirectHost(url.hostname)
}

/**
 * Clients an operator pre-registered, so an organisation can paste its own
 * `client_id` when adding PinSquirrel as a custom connector.
 *
 * They are public clients with PKCE like every other client here: the server
 * metadata advertises `token_endpoint_auth_methods_supported: ["none"]` and
 * nothing issues or checks a secret, so there is no `client_secret` field to
 * fill in.
 *
 * `client_id` may not look like a URL. An http(s) identifier is resolved by
 * fetching it as a CIMD document (Decision 15), so a row registered under one
 * would never be looked up in the table.
 */
export const staticOAuthClientsSchema = z
  .array(
    z.object({
      client_id: z
        .string()
        .min(1)
        .refine(value => !/^https?:\/\//i.test(value), {
          message:
            'must not be an http(s) URL, which names a CIMD document rather than a stored client',
        }),
      client_name: z.string().min(1).optional(),
      redirect_uris: z
        .array(
          z.string().min(1).refine(isUsableRedirectUri, {
            message: 'must be https, or http on loopback',
          })
        )
        .min(1, 'at least one redirect_uri is required'),
    })
  )
  .superRefine((clients, ctx) => {
    // `client_id` is unique in the table, so two entries sharing one is a
    // configuration that cannot be reconciled - the second would overwrite the
    // first on every boot.
    const seen = new Set<string>()
    clients.forEach((client, index) => {
      if (seen.has(client.client_id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate client_id: ${client.client_id}`,
          path: [index, 'client_id'],
        })
      }
      seen.add(client.client_id)
    })
  })

export type StaticOAuthClientMetadata = z.infer<
  typeof staticOAuthClientsSchema
>[number]
