import { Hono } from 'hono'
import type { Context } from 'hono'
import type { User } from '@pinsquirrel/domain'
import { AccessControl, OAuthError, ValidationError } from '@pinsquirrel/domain'
import { oauthService } from '../lib/services.js'
import { describeValidationError } from '../lib/oauth-error.js'
import { getString } from '../lib/form'
import { getAuthUser, requireAuth } from '../middleware/session'
import { OAuthConsentPage } from '../views/pages/oauth-consent'
import { OAuthErrorPage } from '../views/pages/oauth-error'

/**
 * The browser-facing half of OAuth: `/oauth/authorize` and its consent screen.
 *
 * Mounted after `sessionMiddleware()` and `csrf()`, the opposite of `/mcp` and
 * the token endpoint. This one *is* a browser form on an authenticated
 * session, which is exactly what CSRF protection is for, and `requireAuth()`
 * sends an anonymous visitor through the ordinary sign-in flow. That
 * middleware already carries the full path and query into `redirectTo`, and
 * sign-in resolves it against our own origin before following it, so the
 * return path needs no second check here.
 *
 * The route calls `oauthService` and nothing below it. Every rule - PKCE,
 * redirect matching, the audience, the scopes - lives in the service, so a
 * tampered hidden field is caught by the same checks that rendered the page.
 */

/**
 * The parameters an authorization request is made of.
 *
 * Named explicitly so the hidden fields the consent form posts back are the
 * request and nothing else: an attacker cannot smuggle an extra field through
 * the form into the service's parser.
 */
const AUTHORIZATION_PARAMS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'state',
  'resource',
] as const

function authorizationParams(
  source: Record<string, unknown>
): Record<string, string> {
  const params: Record<string, string> = {}
  for (const name of AUTHORIZATION_PARAMS) {
    const value = getString(source[name])
    if (value !== '') params[name] = value
  }
  return params
}

/** The host a user should recognise, or the raw URI if it will not parse. */
function redirectHost(redirectUri: string): string {
  try {
    return new URL(redirectUri).host
  } catch {
    return redirectUri
  }
}

/**
 * Render the failure rather than redirecting it.
 *
 * Everything reaching here failed before the redirect URI was established as
 * this client's, so there is no address that has been shown to belong to the
 * client. Redirecting an error to an unvalidated URI is how an open
 * redirector gets built.
 */
function renderRequestError(c: Context, user: User | null, error: unknown) {
  if (error instanceof OAuthError) {
    return c.html(
      <OAuthErrorPage
        user={user}
        error={error.code}
        description={error.message}
      />,
      400
    )
  }
  if (error instanceof ValidationError) {
    return c.html(
      <OAuthErrorPage
        user={user}
        error="invalid_request"
        description={describeValidationError(error)}
      />,
      400
    )
  }
  throw error
}

const oauth = new Hono()

oauth.use('*', requireAuth())

oauth.get('/authorize', async c => {
  const user = getAuthUser(c)
  const params = authorizationParams(c.req.query())

  try {
    const resolved = await oauthService.resolveAuthorizationRequest(params)

    return c.html(
      <OAuthConsentPage
        user={user}
        // The name the client published, or the identifier it authenticates
        // as. A client with neither cannot be told apart from an impostor.
        clientLabel={resolved.client.clientName ?? resolved.client.clientId}
        redirectHost={redirectHost(resolved.redirectUri)}
        redirectUri={resolved.redirectUri}
        scopes={resolved.scopes}
        resource={resolved.resource}
        params={params}
      />
    )
  } catch (error) {
    return renderRequestError(c, user, error)
  }
})

oauth.post('/authorize', async c => {
  const user = getAuthUser(c)
  const formData = await c.req.parseBody()
  const params = authorizationParams(formData)
  // Anything that is not the approve button is a refusal. A malformed or
  // absent decision must never read as consent.
  const approved = getString(formData['decision']) === 'approve'

  let outcome
  try {
    outcome = await oauthService.authorize(new AccessControl(user), {
      params,
      userId: user.id,
      approved,
    })
  } catch (error) {
    return renderRequestError(c, user, error)
  }

  const location = new URL(outcome.redirectUri)
  if (outcome.status === 'approved') {
    location.searchParams.set('code', outcome.code)
  } else {
    location.searchParams.set('error', outcome.error)
    location.searchParams.set('error_description', outcome.errorDescription)
  }
  // `state` is the client's CSRF defense, returned exactly as it was sent and
  // omitted entirely when it was not.
  if (outcome.state !== undefined) {
    location.searchParams.set('state', outcome.state)
  }
  // RFC 9207, on success and on failure alike: it is how the client knows
  // which authorization server answered.
  location.searchParams.set('iss', outcome.issuer)

  return c.redirect(location.toString(), 302)
})

export { oauth as oauthRoutes }
