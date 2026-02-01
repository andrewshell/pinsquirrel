import { Hono } from 'hono'
import {
  ValidationError,
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  MissingRoleError,
  UserAlreadyExistsError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
} from '@pinsquirrel/domain'
import { authService } from '../lib/services'
import { getSessionManager } from '../middleware/session'
import { SignInPage } from '../views/pages/signin'
import { SignUpPage } from '../views/pages/signup'
import { ForgotPasswordPage } from '../views/pages/forgot-password'
import { ResetPasswordPage } from '../views/pages/reset-password'

const auth = new Hono()

// GET /signin - Render sign-in form
auth.get('/signin', async (c) => {
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
auth.post('/signin', async (c) => {
  const sessionManager = getSessionManager(c)
  const formData = await c.req.parseBody()

  const username = formData.username as string
  const password = formData.password as string
  const keepSignedIn = formData.keepSignedIn === 'true'
  const redirectTo = formData.redirectTo as string | undefined

  try {
    const user = await authService.login({ username, password })

    // Create session
    await sessionManager.create(user.id, keepSignedIn)

    // Determine redirect destination
    let destination = '/pins'

    // Use redirectTo from form if provided and is a safe relative path
    if (
      redirectTo &&
      redirectTo.startsWith('/') &&
      !redirectTo.startsWith('//')
    ) {
      destination = redirectTo
    }

    return c.redirect(destination)
  } catch (error) {
    let errors: Record<string, string[]> = {}

    if (error instanceof ValidationError) {
      errors = error.fields
    } else if (error instanceof InvalidCredentialsError) {
      errors = { _form: ['Invalid username or password'] }
    } else if (error instanceof EmailVerificationRequiredError) {
      errors = { _form: [error.message] }
    } else if (error instanceof MissingRoleError) {
      errors = { _form: [error.message] }
    } else {
      // Log unexpected errors for debugging
      console.error('[SIGNIN ERROR]', error)
      errors = { _form: ['An unexpected error occurred. Please try again.'] }
    }

    return c.html(
      <SignInPage
        errors={errors}
        redirectTo={redirectTo}
        username={username}
        keepSignedIn={keepSignedIn}
      />,
      error instanceof MissingRoleError ? 403 : 400
    )
  }
})

// GET /signup - Render sign-up form
auth.get('/signup', (c) => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  return c.html(<SignUpPage />)
})

// POST /signup - Process sign-up form
auth.post('/signup', async (c) => {
  const formData = await c.req.parseBody()

  const username = formData.username as string
  const email = formData.email as string

  // Build the reset URL for password verification email
  const url = new URL(c.req.url)
  const resetUrl = `${url.origin}/reset-password`

  try {
    await authService.register({
      username,
      email,
      resetUrl,
      notifyEmail: process.env.NOTIFY_EMAIL || undefined,
    })

    // Return success page - user needs to check email to set password
    return c.html(
      <SignUpPage
        success={true}
        message="Account created! Check your email to set your password and complete registration."
      />
    )
  } catch (error) {
    let errors: Record<string, string[]> = {}

    if (error instanceof ValidationError) {
      errors = error.fields
    } else if (error instanceof UserAlreadyExistsError) {
      errors = { username: ['Username is already taken'] }
    } else {
      // Log unexpected errors for debugging
      console.error('[SIGNUP ERROR]', error)
      errors = { _form: ['An unexpected error occurred. Please try again.'] }
    }

    return c.html(
      <SignUpPage errors={errors} username={username} email={email} />,
      400
    )
  }
})

// GET /forgot-password - Render forgot password form
auth.get('/forgot-password', (c) => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  return c.html(<ForgotPasswordPage />)
})

// POST /forgot-password - Process forgot password form
auth.post('/forgot-password', async (c) => {
  const sessionManager = getSessionManager(c)

  // Already logged in, redirect to home
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  const formData = await c.req.parseBody()
  const email = formData.email as string

  // Build the reset URL
  const url = new URL(c.req.url)
  const resetBaseUrl = `${url.origin}/reset-password`

  try {
    // Request password reset - service handles validation
    await authService.requestPasswordReset({
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
})

// GET /reset-password/:token - Render reset password form
auth.get('/reset-password/:token', async (c) => {
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
  const isValidToken = await authService.validateResetToken(token)
  if (!isValidToken) {
    return c.html(<ResetPasswordPage invalidToken={true} />)
  }

  return c.html(<ResetPasswordPage token={token} />)
})

// POST /reset-password/:token - Process reset password form
auth.post('/reset-password/:token', async (c) => {
  const token = c.req.param('token')
  if (!token) {
    return c.redirect('/forgot-password')
  }

  const formData = await c.req.parseBody()
  const newPassword = formData.newPassword as string
  const confirmPassword = formData.confirmPassword as string

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
    await authService.resetPassword({
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

// POST /signout - Process sign out
auth.post('/signout', async (c) => {
  const sessionManager = getSessionManager(c)
  await sessionManager.destroy()
  return c.redirect('/signin')
})

// GET /signout - Also support GET for convenience
auth.get('/signout', async (c) => {
  const sessionManager = getSessionManager(c)
  await sessionManager.destroy()
  return c.redirect('/signin')
})

export { auth as authRoutes }
