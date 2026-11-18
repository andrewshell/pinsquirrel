import { Hono } from 'hono'
import {
  AccessControl,
  InvalidCredentialsError,
  OAuthError,
  UserAlreadyExistsError,
  ValidationError,
} from '@pinsquirrel/domain'
import { accountService, authService, oauthService } from '../lib/services'
import { isEmbedRequest, withEmbed } from '../lib/embed'
import { getString } from '../lib/form'
import {
  getAuthUser,
  getSessionManager,
  requireAuth,
} from '../middleware/session'
import {
  privateUnlockLimiter,
  retryAfterSeconds,
} from '../middleware/rate-limit'
import { reserve } from '../middleware/rate-limiter'
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

  const grants = await oauthService.listGrants(new AccessControl(user), user.id)

  return c.html(
    <ProfilePage
      user={user}
      flash={flash}
      grants={grants}
      embed={isEmbedRequest(c)}
    />
  )
})

// POST /profile - Handle form submissions
profile.post('/', async c => {
  const sessionManager = getSessionManager(c)
  const user = getAuthUser(c)

  // Parse form data
  const formData = await c.req.parseBody()

  const intent = getString(formData['intent'])
  const embed = getString(formData['embed']) === '1'
  const back = withEmbed('/profile', embed)

  const rerender = async (
    errors: Record<string, string[]>,
    status: 400 | 429 | 500
  ) => {
    const grants = await oauthService.listGrants(
      new AccessControl(user),
      user.id
    )
    return c.html(
      <ProfilePage user={user} grants={grants} errors={errors} embed={embed} />,
      status
    )
  }

  try {
    if (intent === 'update-email') {
      const email = getString(formData['email'])

      await accountService.updateEmail(new AccessControl(user), {
        userId: user.id,
        email: email === '' ? null : email,
      })

      sessionManager.setFlash('success', 'Email updated successfully!')
      return c.redirect(back)
    }

    // Revoking takes the whole grant family, access token and refresh token
    // together: leaving either alive would let the client carry on.
    if (intent === 'revoke-oauth-grant') {
      const tokenId = getString(formData['tokenId'])

      await oauthService.revokeGrant(new AccessControl(user), tokenId)

      sessionManager.setFlash('success', 'Application access revoked!')
      return c.redirect(back)
    }

    if (intent === 'change-password') {
      const currentPassword = getString(formData['currentPassword'])
      const newPassword = getString(formData['newPassword'])

      const attempt = reserve([[privateUnlockLimiter, user.id]])
      if (attempt.limited) {
        c.header('Retry-After', retryAfterSeconds(attempt.retryAfterMs))
        return await rerender(
          {
            currentPassword: [
              'Too many failed attempts. Please try again in 15 minutes.',
            ],
          },
          429
        )
      }

      try {
        await authService.changePassword(new AccessControl(user), {
          userId: user.id,
          currentPassword,
          newPassword,
        })
      } catch (error) {
        if (!(error instanceof InvalidCredentialsError)) attempt.release()
        throw error
      }
      privateUnlockLimiter.reset(user.id)

      sessionManager.setFlash('success', 'Password changed successfully!')
      return c.redirect(back)
    }

    // Invalid intent
    return c.html(
      <ProfilePage
        user={user}
        errors={{ _form: ['Invalid action'] }}
        embed={embed}
      />,
      400
    )
  } catch (error) {
    if (error instanceof ValidationError) {
      return rerender(error.fields, 400)
    }

    // A grant that is gone, or one that was never this user's. Either way the
    // form is stale rather than the server broken, and saying which it was
    // would tell somebody whether a token id exists.
    if (error instanceof OAuthError) {
      return rerender(
        { _form: ['That application access is no longer active.'] },
        400
      )
    }

    // One account per email is a database constraint, so a taken address
    // reaches us as a thrown error rather than a validation failure. It is
    // still a rejected form, not a server fault.
    if (error instanceof UserAlreadyExistsError) {
      return rerender({ email: ['That email address is already in use'] }, 400)
    }

    if (error instanceof InvalidCredentialsError) {
      return rerender(
        { currentPassword: ['Current password is incorrect'] },
        400
      )
    }

    // Generic error
    return rerender(
      { _form: ['An unexpected error occurred. Please try again.'] },
      500
    )
  }
})

export { profile as profileRoutes }
