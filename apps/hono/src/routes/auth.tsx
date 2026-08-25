import { Hono } from 'hono'
import {
  ValidationError,
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  MissingRoleError,
  AccessNotGrantedError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
} from '@pinsquirrel/domain'
import { accountService, authService } from '../lib/services'
import { getString } from '../lib/form'
import { logger, safeError } from '../lib/logger.js'
import { getSessionManager } from '../middleware/session'
import {
  signinLimiter,
  signinIpLimiter,
  signinRateLimitKey,
  getClientIp,
  signupLimiter,
  forgotPasswordLimiter,
  rateLimitByIp,
} from '../middleware/rate-limit'
import { SignInPage } from '../views/pages/signin'
import { SignUpPage } from '../views/pages/signup'
import { ForgotPasswordPage } from '../views/pages/forgot-password'
import { ResetPasswordPage } from '../views/pages/reset-password'

const auth = new Hono()

/**
 * Resolve a post-sign-in `redirectTo` against our own origin and keep it only
 * if it stays there.
 *
 * String prefix checks are not enough: browsers normalise `/\evil.test` to
 * `//evil.test`, and the URL parser strips tabs and newlines, so `/<tab>/evil`
 * is protocol-relative too. Parsing is the only way to see what the browser
 * will see. The resolved path is what gets returned, so any such smuggled
 * characters are gone from the `Location` header as well.
 */
function safeRedirect(
  redirectTo: string | undefined,
  requestUrl: string,
  fallback: string
): string {
  if (!redirectTo || !redirectTo.startsWith('/')) return fallback

  const origin = new URL(requestUrl).origin

  try {
    const resolved = new URL(redirectTo, origin)
    if (resolved.origin !== origin) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}

// GET /signin - Render sign-in form
auth.get('/signin', async c => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  // Check for password reset success and redirectTo parameter
  const url = new URL(c.req.url)
  const reset = url.searchParams.get('reset')
  const redirectTo = url.searchParams.get('redirectTo')
  const showResetSuccess = reset === 'success'

  // Get flash message if any
  const flash = sessionManager.getFlash()

  return c.html(
    <SignInPage
      showResetSuccess={showResetSuccess}
      redirectTo={redirectTo}
      flash={flash}
    />
  )
})

// POST /signin - Process sign-in form
auth.post('/signin', async c => {
  const sessionManager = getSessionManager(c)
  const formData = await c.req.parseBody()

  const username = getString(formData.username)
  const password = getString(formData.password)
  const keepSignedIn = formData.keepSignedIn === 'true'
  const redirectTo = getString(formData.redirectTo) || undefined

  // Two keys, two attacks. The IP:username key stops guessing at one account;
  // the IP-only key stops one address spraying a password across many
  // usernames, which the first never sees because every guess lands in a fresh
  // bucket.
  const rateLimitKey = signinRateLimitKey(c, username || '')
  const ipKey = getClientIp(c)
  if (
    signinLimiter.isLimited(rateLimitKey) ||
    signinIpLimiter.isLimited(ipKey)
  ) {
    return c.html(
      <SignInPage
        errors={{
          _form: [
            'Too many failed sign-in attempts. Please try again in 15 minutes.',
          ],
        }}
        redirectTo={redirectTo}
        username={username}
      />,
      429
    )
  }

  try {
    const user = await authService.login({ username, password })

    // Only the per-account counter is cleared. Clearing the IP counter too
    // would let an attacker who owns one valid account wipe their spray budget
    // by signing into it between rounds.
    signinLimiter.reset(rateLimitKey)

    // Create session
    await sessionManager.create(user.id, keepSignedIn)

    // Use redirectTo from the form when it stays on this origin
    return c.redirect(safeRedirect(redirectTo, c.req.url, '/pins'))
  } catch (error) {
    let errors: Record<string, string[]>

    if (error instanceof ValidationError) {
      errors = error.fields
    } else if (error instanceof InvalidCredentialsError) {
      signinLimiter.hit(rateLimitKey)
      signinIpLimiter.hit(ipKey)
      errors = { _form: ['Invalid username or password'] }
    } else if (error instanceof EmailVerificationRequiredError) {
      errors = { _form: [error.message] }
    } else if (error instanceof MissingRoleError) {
      errors = { _form: [error.message] }
    } else if (error instanceof AccessNotGrantedError) {
      // Verified user still waiting on the early-access waitlist
      errors = { _form: [error.message] }
    } else {
      // Log unexpected errors for debugging
      logger.error({ err: safeError(error) }, 'Signin failed')
      errors = { _form: ['An unexpected error occurred. Please try again.'] }
    }

    return c.html(
      <SignInPage
        errors={errors}
        redirectTo={redirectTo}
        username={username}
        keepSignedIn={keepSignedIn}
      />,
      error instanceof MissingRoleError ||
        error instanceof AccessNotGrantedError
        ? 403
        : 400
    )
  }
})

// GET /signup - Render sign-up form
auth.get('/signup', c => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  return c.html(<SignUpPage />)
})

// POST /signup - Process sign-up form
auth.post(
  '/signup',
  rateLimitByIp(
    signupLimiter,
    'Too many sign-up attempts. Please try again later.'
  ),
  async c => {
    const formData = await c.req.parseBody()

    const username = getString(formData.username)
    const email = getString(formData.email)

    // Build the reset URL for password verification email
    const url = new URL(c.req.url)
    const resetUrl = `${url.origin}/reset-password`

    try {
      const result = await accountService.register({
        username,
        email,
        resetUrl,
        notifyEmail: process.env.NOTIFY_EMAIL || undefined,
        signinUrl: `${url.origin}/signin`,
        signupUrl: `${url.origin}/signup`,
      })

      if (result.emailFailed) {
        logger.error('Verification email failed to send during signup')
        return c.html(
          <SignUpPage
            success={true}
            message="You're on the waitlist, but we had trouble sending your confirmation email."
            showResendLink={true}
          />
        )
      }

      // Always show success - conflicts are communicated privately via email
      return c.html(
        <SignUpPage
          success={true}
          message="Check your email to confirm your spot on the early-access waitlist."
        />
      )
    } catch (error) {
      let errors: Record<string, string[]>

      if (error instanceof ValidationError) {
        errors = error.fields
      } else {
        // Log unexpected errors for debugging
        logger.error({ err: safeError(error) }, 'Signup failed')
        errors = { _form: ['An unexpected error occurred. Please try again.'] }
      }

      return c.html(
        <SignUpPage errors={errors} username={username} email={email} />,
        400
      )
    }
  }
)

// GET /forgot-password - Render forgot password form
auth.get('/forgot-password', c => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  return c.html(<ForgotPasswordPage />)
})

// POST /forgot-password - Process forgot password form
auth.post(
  '/forgot-password',
  rateLimitByIp(
    forgotPasswordLimiter,
    'Too many password reset requests. Please try again later.'
  ),
  async c => {
    const sessionManager = getSessionManager(c)

    // Already logged in, redirect to home
    if (sessionManager.isAuthenticated()) {
      return c.redirect('/pins')
    }

    const formData = await c.req.parseBody()
    const email = getString(formData.email)

    // Build the reset URL
    const url = new URL(c.req.url)
    const resetBaseUrl = `${url.origin}/reset-password`

    try {
      // Request password reset - service handles validation
      await accountService.requestPasswordReset({
        email,
        resetUrl: resetBaseUrl,
      })

      // Always show success message to avoid revealing whether email exists
      return c.html(<ForgotPasswordPage success={true} />)
    } catch (error) {
      if (error instanceof ValidationError) {
        return c.html(
          <ForgotPasswordPage errors={error.fields} email={email} />,
          400
        )
      }

      // Check for rate limiting error
      if (error instanceof Error && error.message.includes('Too many')) {
        return c.html(
          <ForgotPasswordPage
            errors={{
              _form: [
                'Too many password reset requests. Please try again later.',
              ],
            }}
            email={email}
          />,
          429
        )
      }

      return c.html(
        <ForgotPasswordPage
          errors={{ _form: ['An error occurred. Please try again later.'] }}
          email={email}
        />,
        500
      )
    }
  }
)

// GET /reset-password/:token - Render reset password form
auth.get('/reset-password/:token', async c => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  const token = c.req.param('token')
  if (!token) {
    return c.redirect('/forgot-password')
  }

  // Validate the token
  const isValidToken = await accountService.validateResetToken(token)
  if (!isValidToken) {
    return c.html(<ResetPasswordPage invalidToken={true} />)
  }

  return c.html(<ResetPasswordPage token={token} />)
})

// POST /reset-password/:token - Process reset password form
auth.post('/reset-password/:token', async c => {
  const token = c.req.param('token')
  if (!token) {
    return c.redirect('/forgot-password')
  }

  const formData = await c.req.parseBody()
  const newPassword = getString(formData.newPassword)
  const confirmPassword = getString(formData.confirmPassword)

  // Check password confirmation
  if (newPassword !== confirmPassword) {
    return c.html(
      <ResetPasswordPage
        token={token}
        errors={{ confirmPassword: ['Passwords do not match'] }}
      />,
      400
    )
  }

  try {
    // Service handles password validation
    await accountService.resetPassword({
      token,
      newPassword,
    })

    // Redirect to signin with success message
    return c.redirect('/signin?reset=success')
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(
        <ResetPasswordPage token={token} errors={error.fields} />,
        400
      )
    }

    if (
      error instanceof InvalidResetTokenError ||
      error instanceof ResetTokenExpiredError
    ) {
      return c.html(<ResetPasswordPage invalidToken={true} />)
    }

    return c.html(
      <ResetPasswordPage
        token={token}
        errors={{
          _form: [
            'An error occurred. Please try again or request a new reset link.',
          ],
        }}
      />,
      500
    )
  }
})

// POST /signout - Process sign out. POST only: csrf() does not guard GET, so a
// GET twin would let <img src="/signout"> on any site sign the user out.
auth.post('/signout', async c => {
  const sessionManager = getSessionManager(c)
  await sessionManager.destroy()
  return c.redirect('/signin')
})

export { auth as authRoutes }
