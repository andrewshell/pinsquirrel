import {
  STUB_REDIRECT_URL,
  stubChrome,
  type ChromeStub,
} from './chrome-mock.ts'
import { jsonResponse, stubFetch, type StubbedFetch } from './fetch-mock.ts'

/**
 * The PinSquirrel OAuth server, stubbed.
 *
 * The documents and responses here are shaped after
 * `apps/hono/src/routes/oauth-metadata.ts`, `oauth-register.ts` and
 * `oauth-token.ts`, so a test that passes against this stub is a test whose
 * request shapes the real server accepts.
 */

export const BASE_URL = 'https://pinsquirrel.com'
export const RESOURCE = `${BASE_URL}/api/v1`
export const REGISTERED_CLIENT_ID = 'dcr_registered'

/** One form-encoded request, as the route handler saw it. */
export type PostedForm = Record<string, string>

export interface OAuthServerStub {
  chrome: ChromeStub
  fetched: StubbedFetch
  /** Every body posted to `/oauth/register`, parsed. */
  registrations: unknown[]
  /** Every form posted to `/oauth/token`, in order. */
  tokenRequests: PostedForm[]
  /** Every form posted to `/oauth/revoke`, in order. */
  revocations: PostedForm[]
  /** Every authorization URL `launchWebAuthFlow` was asked to open. */
  authorizations: URL[]
  /** Replace what `/oauth/token` answers with, for the next call onwards. */
  answerTokenWith(handler: (form: PostedForm) => Response): void
}

/** The request body as text. Every request this stub answers posts a string. */
function bodyText(init: RequestInit | undefined): string {
  return typeof init?.body === 'string' ? init.body : ''
}

function formOf(init: RequestInit | undefined): PostedForm {
  return Object.fromEntries(new URLSearchParams(bodyText(init)))
}

/** The token response the real server sends after a successful exchange. */
export function tokenResponse(
  overrides: Record<string, unknown> = {}
): Response {
  return jsonResponse({
    access_token: 'pso_access',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'refresh-1',
    scope: 'pins:read tags:read offline_access',
    ...overrides,
  })
}

/** An RFC 6749 error response, as the token endpoint returns one. */
export function oauthErrorResponse(code: string, status = 400): Response {
  return jsonResponse(
    { error: code, error_description: `stubbed ${code}` },
    status
  )
}

/** Stub discovery, registration, the consent flow and the token endpoint. */
export function stubOAuthServer(
  initialStorage: Record<string, unknown> = {}
): OAuthServerStub {
  const registrations: unknown[] = []
  const tokenRequests: PostedForm[] = []
  const revocations: PostedForm[] = []
  const authorizations: URL[] = []
  let tokenHandler: (form: PostedForm) => Response = () => tokenResponse()

  const chrome = stubChrome(initialStorage)
  const fetched = stubFetch({
    [`${BASE_URL}/.well-known/oauth-protected-resource/api/v1`]: jsonResponse({
      resource: RESOURCE,
      authorization_servers: [BASE_URL],
      scopes_supported: ['pins:read', 'tags:read'],
    }),
    [`${BASE_URL}/.well-known/oauth-authorization-server`]: jsonResponse({
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/oauth/authorize`,
      token_endpoint: `${BASE_URL}/oauth/token`,
      registration_endpoint: `${BASE_URL}/oauth/register`,
      revocation_endpoint: `${BASE_URL}/oauth/revoke`,
      code_challenge_methods_supported: ['S256'],
    }),
    [`${BASE_URL}/oauth/register`]: (_url, init) => {
      registrations.push(JSON.parse(bodyText(init) || 'null'))
      return jsonResponse({ client_id: REGISTERED_CLIENT_ID }, 201)
    },
    [`${BASE_URL}/oauth/token`]: (_url, init) => {
      const form = formOf(init)
      tokenRequests.push(form)
      return tokenHandler(form)
    },
    [`${BASE_URL}/oauth/revoke`]: (_url, init) => {
      revocations.push(formOf(init))
      // RFC 7009: always 200, with no body.
      return new Response(null, { status: 200 })
    },
  })

  // Chrome opens the consent page, the user approves, and the server sends the
  // browser back to the extension's callback with a code.
  chrome.launchWebAuthFlow.mockImplementation(details => {
    const url = new URL(details.url)
    authorizations.push(url)
    const back = new URL(STUB_REDIRECT_URL)
    back.searchParams.set('code', `code-${authorizations.length}`)
    back.searchParams.set('state', url.searchParams.get('state') ?? '')
    back.searchParams.set('iss', BASE_URL)
    return Promise.resolve(back.toString())
  })

  return {
    chrome,
    fetched,
    registrations,
    tokenRequests,
    revocations,
    authorizations,
    answerTokenWith: handler => {
      tokenHandler = handler
    },
  }
}
