import { Hono } from 'hono'
import {
  AccessControl,
  InvalidCredentialsError,
  OAuthError,
  ValidationError,
  WriteConflictError,
} from '@pinsquirrel/domain'
import { accountService, authService, oauthService } from '../lib/services'
import { baseUrl } from '../lib/config'
import { logger, safeError } from '../lib/logger.js'
import { isEmbedRequest, withEmbed } from '../lib/embed'
import { getString } from '../lib/form'
import {
  getAuthUser,
  getSessionManager,
  requireAuth,
} from '../middleware/session'
import {
  emailChangeLimiter,
  privateUnlockLimiter,
  retryAfterSeconds,
} from '../middleware/rate-limit'
import { reserve } from '../middleware/rate-limiter'
import { PROFILE_INTENTS, ProfilePage } from '../views/pages/profile'

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

  const postedIntent = getString(formData['intent'])
  const intent = PROFILE_INTENTS.find(known => known === postedIntent)
  const embed = getString(formData['embed']) === '1'
  const back = withEmbed('/profile', embed)

  const rerender = async (
    errors: Record<string, string[]>,
    status: 400 | 429 | 500 | 503
  ) => {
    const grants = await oauthService.listGrants(
      new AccessControl(user),
      user.id
    )
    return c.html(
      <ProfilePage
        user={user}
        grants={grants}
        errors={errors}
        failedIntent={intent}
        embed={embed}
      />,
      status
    )
  }

  try {
    if (intent === 'update-email') {
      const sendWaitMs = emailChangeLimiter.retryAfterMs(user.id, Date.now())
      const attempt =
        sendWaitMs > 0
          ? { limited: true as const, retryAfterMs: sendWaitMs }
          : reserve([[privateUnlockLimiter, user.id]])
      if (attempt.limited) {
        c.header('Retry-After', retryAfterSeconds(attempt.retryAfterMs))
        return await rerender(
          { emailPassword: ['Too many attempts. Please try again later.'] },
          429
        )
      }

      try {
        await accountService.requestEmailChange(new AccessControl(user), {
          userId: user.id,
          email: getString(formData['email']),
          currentEmail: getString(formData['currentEmail']),
          currentPassword: getString(formData['emailPassword']),
          confirmUrl: `${baseUrl}/confirm-email`,
        })
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return await rerender(
            {
              emailPassword: [
                'Your current password or email address is incorrect',
              ],
            },
            400
          )
        }
        attempt.release()
        throw error
      }
      privateUnlockLimiter.reset(user.id)
      emailChangeLimiter.hit(user.id)

      sessionManager.setFlash(
        'success',
        'Check your new address for a confirmation link. Your email changes once you follow it.'
      )
      return c.redirect(back)
    }

    if (intent === 'revoke-oauth-grant') {
      await oauthService.revokeGrant(
        new AccessControl(user),
        user.id,
        getString(formData['clientId'])
      )

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
          keepSessionId: sessionManager.getSession()?.id,
        })
      } catch (error) {
        if (!(error instanceof InvalidCredentialsError)) attempt.release()
        if (error instanceof WriteConflictError) {
          logger.warn(
            { cause: safeError(error.cause) },
            'Password change lost to another write'
          )
          c.header('Retry-After', '1')
          return await rerender(
            {
              _form: [
                'The server was busy and your password was not changed. Please try again.',
              ],
            },
            503
          )
        }
        throw error
      }
      privateUnlockLimiter.reset(user.id)

      sessionManager.setFlash('success', 'Password changed successfully!')
      return c.redirect(back)
    }

    return await rerender({ _form: ['Invalid action'] }, 400)
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

    if (error instanceof InvalidCredentialsError) {
      return rerender(
        { currentPassword: ['Current password is incorrect'] },
        400
      )
    }

    logger.error({ err: safeError(error) }, 'Profile update failed')
    return rerender(
      { _form: ['An unexpected error occurred. Please try again.'] },
      500
    )
  }
})

export { profile as profileRoutes }
