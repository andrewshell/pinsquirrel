import { Hono } from 'hono'
import {
  AccessControl,
  ApiKeyLimitExceededError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  ValidationError,
} from '@pinsquirrel/domain'
import { accountService, apiKeyService, authService } from '../lib/services'
import { getString } from '../lib/form'
import {
  getAuthUser,
  getSessionManager,
  requireAuth,
} from '../middleware/session'
import { ProfilePage } from '../views/pages/profile'

const profile = new Hono()

// Apply auth middleware to all profile routes
profile.use('*', requireAuth())

// GET /profile - Show profile page
profile.get('/', async c => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  // Get flash message if any
  const flash = sessionManager.getFlash()

  // Fetch user's API keys
  const ac = new AccessControl(user)
  const apiKeys = await apiKeyService.listApiKeys(ac, user.id)

  return c.html(<ProfilePage user={user} flash={flash} apiKeys={apiKeys} />)
})

// POST /profile - Handle form submissions
profile.post('/', async c => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  // Parse form data
  const formData = await c.req.parseBody()

  const intent = getString(formData['intent'])

  try {
    if (intent === 'update-email') {
      const email = getString(formData['email'])

      await accountService.updateEmail(new AccessControl(user), {
        userId: user.id,
        email: email === '' ? null : email,
      })

      sessionManager.setFlash('success', 'Email updated successfully!')
      return c.redirect('/profile')
    }

    // The one intent that does not redirect. Its response body *is* the
    // payload: the raw key is shown once and never recoverable, so surviving a
    // redirect would mean writing a live credential into the sessions table.
    if (intent === 'create-api-key') {
      const name = getString(formData['name'])
      const ac = new AccessControl(user)

      const { rawKey } = await apiKeyService.createApiKey(ac, {
        userId: user.id,
        name,
      })

      const apiKeys = await apiKeyService.listApiKeys(ac, user.id)

      return c.html(
        <ProfilePage user={user} apiKeys={apiKeys} newApiKey={rawKey} />
      )
    }

    if (intent === 'revoke-api-key') {
      const keyId = getString(formData['keyId'])
      const ac = new AccessControl(user)

      await apiKeyService.revokeApiKey(ac, keyId)

      sessionManager.setFlash('success', 'API key revoked successfully!')
      return c.redirect('/profile')
    }

    if (intent === 'change-password') {
      const currentPassword = getString(formData['currentPassword'])
      const newPassword = getString(formData['newPassword'])

      await authService.changePassword(new AccessControl(user), {
        userId: user.id,
        currentPassword,
        newPassword,
      })

      sessionManager.setFlash('success', 'Password changed successfully!')
      return c.redirect('/profile')
    }

    // Invalid intent
    return c.html(
      <ProfilePage user={user} errors={{ _form: ['Invalid action'] }} />,
      400
    )
  } catch (error) {
    // Fetch API keys for error rendering (needed if the error came from an API key action)
    const ac = new AccessControl(user)
    const apiKeys = await apiKeyService.listApiKeys(ac, user.id)

    if (error instanceof ValidationError) {
      return c.html(
        <ProfilePage user={user} apiKeys={apiKeys} errors={error.fields} />,
        400
      )
    }

    if (error instanceof ApiKeyLimitExceededError) {
      return c.html(
        <ProfilePage
          user={user}
          apiKeys={apiKeys}
          errors={{ _form: [error.message] }}
        />,
        400
      )
    }

    // One account per email is a database constraint, so a taken address
    // reaches us as a thrown error rather than a validation failure. It is
    // still a rejected form, not a server fault.
    if (error instanceof UserAlreadyExistsError) {
      return c.html(
        <ProfilePage
          user={user}
          apiKeys={apiKeys}
          errors={{ email: ['That email address is already in use'] }}
        />,
        400
      )
    }

    if (error instanceof InvalidCredentialsError) {
      return c.html(
        <ProfilePage
          user={user}
          apiKeys={apiKeys}
          errors={{ currentPassword: ['Current password is incorrect'] }}
        />,
        400
      )
    }

    // Generic error
    return c.html(
      <ProfilePage
        user={user}
        apiKeys={apiKeys}
        errors={{ _form: ['An unexpected error occurred. Please try again.'] }}
      />,
      500
    )
  }
})

export { profile as profileRoutes }
