import { Hono } from 'hono'
import { InvalidCredentialsError, ValidationError } from '@pinsquirrel/domain'
import { authService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { ProfilePage } from '../views/pages/profile'

const profile = new Hono()

// Apply auth middleware to all profile routes
profile.use('*', requireAuth())

// GET /profile - Show profile page
profile.get('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  // Get flash message if any
  const flash = sessionManager.getFlash()

  return c.html(<ProfilePage user={user} flash={flash} />)
})

// POST /profile - Handle form submissions
profile.post('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  // Parse form data
  const formData = await c.req.parseBody()

  // Helper to get string values
  const getString = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return getString(value[0])
    return ''
  }

  const intent = getString(formData['intent'])

  try {
    if (intent === 'update-email') {
      const email = getString(formData['email'])

      await authService.updateEmail({
        userId: user.id,
        email: email === '' ? null : email,
      })

      // Re-fetch user to get updated data
      const updatedUser = await sessionManager.getUser()

      return c.html(
        <ProfilePage user={updatedUser || user} emailSuccess={true} />
      )
    }

    if (intent === 'change-password') {
      const currentPassword = getString(formData['currentPassword'])
      const newPassword = getString(formData['newPassword'])

      await authService.changePassword({
        userId: user.id,
        currentPassword,
        newPassword,
      })

      return c.html(<ProfilePage user={user} passwordSuccess={true} />)
    }

    // Invalid intent
    return c.html(
      <ProfilePage user={user} errors={{ _form: ['Invalid action'] }} />,
      400
    )
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(<ProfilePage user={user} errors={error.fields} />, 400)
    }

    if (error instanceof InvalidCredentialsError) {
      return c.html(
        <ProfilePage
          user={user}
          errors={{ currentPassword: ['Current password is incorrect'] }}
        />,
        400
      )
    }

    // Generic error
    return c.html(
      <ProfilePage
        user={user}
        errors={{ _form: ['An unexpected error occurred. Please try again.'] }}
      />,
      500
    )
  }
})

export { profile as profileRoutes }
