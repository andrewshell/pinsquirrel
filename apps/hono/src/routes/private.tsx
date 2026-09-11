import { Hono } from 'hono'
import { ValidationError, InvalidCredentialsError } from '@pinsquirrel/domain'
import { authService } from '../lib/services'
import { isEmbedRequest } from '../lib/embed'
import { getString } from '../lib/form'
import { safeRedirect } from '../lib/safe-redirect'
import {
  getAuthUser,
  getSessionManager,
  requireAuth,
} from '../middleware/session'
import { requirePrivateUnlock } from '../middleware/private-mode'
import { privateUnlockLimiter } from '../middleware/rate-limit'
import { PrivateUnlockPage } from '../views/pages/private-unlock'
import { createPinRoutes } from './pin-routes'

const BASE_URL = '/private/pins'

const privateRouter = new Hono()

// All private routes require authentication
privateRouter.use('*', requireAuth())

// GET /private/unlock — Password form
privateRouter.get('/unlock', async c => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  // If already unlocked, redirect to private pins
  if (sessionManager.isPrivateUnlocked()) {
    return c.redirect(BASE_URL)
  }

  // Where the gate sent us from, if it said. Checked here as well as on the
  // POST so the hidden field never carries a URL that would be refused later.
  const url = new URL(c.req.url)
  const redirectTo = safeRedirect(
    url.searchParams.get('redirectTo') ?? undefined,
    c.req.url,
    ''
  )

  return c.html(
    <PrivateUnlockPage
      user={user}
      redirectTo={redirectTo || undefined}
      embed={isEmbedRequest(c)}
    />
  )
})

// POST /private/unlock — Verify password and unlock
privateRouter.post('/unlock', async c => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  const formData = await c.req.parseBody()
  const password =
    typeof formData.password === 'string' ? formData.password : ''
  const redirectTo = getString(formData.redirectTo) || undefined
  const embed = getString(formData.embed) === '1'

  const rerender = (error: string, status?: 429) =>
    c.html(
      <PrivateUnlockPage
        user={user}
        error={error}
        redirectTo={redirectTo}
        embed={embed}
      />,
      status
    )

  // This checks the account password on every POST, so unlimited it is a
  // password-guessing oracle for anyone who has got hold of the session.
  if (privateUnlockLimiter.isLimited(user.id)) {
    return rerender(
      'Too many failed attempts. Please try again in 15 minutes.',
      429
    )
  }

  try {
    await authService.login({ username: user.username, password })
    privateUnlockLimiter.reset(user.id)
    sessionManager.unlockPrivateMode()
    return c.redirect(safeRedirect(redirectTo, c.req.url, BASE_URL))
  } catch (error) {
    if (
      error instanceof InvalidCredentialsError ||
      error instanceof ValidationError
    ) {
      // Only a wrong password burns an attempt. ValidationError here means an
      // empty or malformed field, which never reached a credential check.
      if (error instanceof InvalidCredentialsError) {
        privateUnlockLimiter.hit(user.id)
      }
      return rerender('Invalid password.')
    }
    throw error
  }
})

// POST /private/lock — Lock private mode and redirect
privateRouter.post('/lock', c => {
  const sessionManager = getSessionManager(c)
  sessionManager.lockPrivateMode()

  // The tab-close beacon (private-mode.js) marks itself with ?beacon=1 and
  // has nowhere to follow a redirect to, so answer it with 204.
  if (c.req.query('beacon') === '1') {
    return c.body(null, 204)
  }

  return c.redirect('/pins')
})

// Everything below the unlock gate. Both registrations are kept: `/pins/*`
// covers the sub-routes and `/pins` the bare list. (On Hono 4.13 the wildcard
// already matches the bare path, so the second is belt-and-braces — but the
// cost of being wrong here is every private pin readable while locked.)
privateRouter.use('/pins/*', requirePrivateUnlock())
privateRouter.use('/pins', requirePrivateUnlock())

// The pin CRUD routes, in their private configuration: the list is filtered to
// private pins, new pins are forced private, and the pages render the private
// chrome. See createPinRoutes for what else differs from the public mount.
privateRouter.route(
  '/pins',
  createPinRoutes({ baseUrl: BASE_URL, privateMode: true })
)

export { privateRouter as privateRoutes }
