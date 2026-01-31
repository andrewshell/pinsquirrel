import { Hono } from 'hono'
import {
  ValidationError,
  InvalidCredentialsError,
  EmailVerificationRequiredError,
  MissingRoleError,
  UserAlreadyExistsError,
} from '@pinsquirrel/domain'
import { authService } from '../lib/services'
import { getSessionManager } from '../middleware/session'
import { SignInPage } from '../views/pages/signin'
import { SignUpPage } from '../views/pages/signup'

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
      errors = { _form: ['An unexpected error occurred. Please try again.'] }
    }

    return c.html(
      <SignUpPage errors={errors} username={username} email={email} />,
      400
    )
  }
})

// POST /logout - Process logout
auth.post('/logout', async (c) => {
  const sessionManager = getSessionManager(c)
  await sessionManager.destroy()
  return c.redirect('/signin')
})

// GET /logout - Also support GET for convenience
auth.get('/logout', async (c) => {
  const sessionManager = getSessionManager(c)
  await sessionManager.destroy()
  return c.redirect('/signin')
})

export { auth as authRoutes }
