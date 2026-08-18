import { Hono } from 'hono'
import { ValidationError, InvalidCredentialsError } from '@pinsquirrel/domain'
import { authService } from '../lib/services'
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
privateRouter.get('/unlock', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  // If already unlocked, redirect to private pins
  if (sessionManager.isPrivateUnlocked()) {
    return c.redirect(BASE_URL)
  }

  return c.html(<PrivateUnlockPage user={user} />)
})

// POST /private/unlock — Verify password and unlock
privateRouter.post('/unlock', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  const formData = await c.req.parseBody()
  const password =
    typeof formData.password === 'string' ? formData.password : ''

  // This checks the account password on every POST, so unlimited it is a
  // password-guessing oracle for anyone who has got hold of the session.
  if (privateUnlockLimiter.isLimited(user.id)) {
    return c.html(
      <PrivateUnlockPage
        user={user}
        error="Too many failed attempts. Please try again in 15 minutes."
      />,
      429
    )
  }

  try {
    await authService.login({ username: user.username, password })
    privateUnlockLimiter.reset(user.id)
    sessionManager.unlockPrivateMode()
    return c.redirect(BASE_URL)
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
      return c.html(<PrivateUnlockPage user={user} error="Invalid password." />)
    }
    throw error
  }
})

// POST /private/lock — Lock private mode and redirect
privateRouter.post('/lock', (c) => {
  const sessionManager = getSessionManager(c)
  sessionManager.lockPrivateMode()

  // For beacon requests (tab close), return 204
  if (c.req.header('Content-Type')?.includes('text/plain')) {
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
