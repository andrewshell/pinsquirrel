import { useLoaderData, data } from 'react-router'
import type { Route } from './+types/profile'
import { requireUser } from '~/lib/session.server'
import { InvalidCredentialsError, ValidationError } from '@pinsquirrel/domain'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { UpdateEmailForm } from '~/components/profile/UpdateEmailForm'
import { ChangePasswordForm } from '~/components/profile/ChangePasswordForm'
import { BookmarkletSection } from '~/components/profile/BookmarkletSection'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'

import { authService } from '~/lib/services/container.server'

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Profile Settings - PinSquirrel',
    },
    {
      name: 'description',
      content: 'Manage your PinSquirrel account settings, email, and password.',
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request)
  return { user }
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request)
  const formData = await parseFormData(request)
  const intent = formData.intent

  logger.request(request, {
    action: 'profile-update',
    intent,
    userId: user.id,
  })

  try {
    if (intent === 'update-email') {
      await authService.updateEmailFromFormData(user.id, formData)

      logger.info('User email updated', {
        userId: user.id,
        hasEmail: !!formData.email,
      })

      return data({
        success: 'Email updated successfully',
        field: 'email',
      })
    }

    if (intent === 'change-password') {
      await authService.changePasswordFromFormData(user.id, formData)

      logger.info('User password changed', {
        userId: user.id,
      })

      return data({
        success: 'Password changed successfully',
        field: 'password',
      })
    }

    return data(
      {
        errors: {
          _form: 'Invalid action',
        },
      },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.debug('Profile update validation failed', { errors: error.fields })
      return data({ errors: error.fields }, { status: 400 })
    }

    if (error instanceof InvalidCredentialsError) {
      logger.debug('Invalid credentials during profile update')
      return data(
        {
          errors: {
            currentPassword: 'Current password is incorrect',
          },
        },
        { status: 400 }
      )
    }

    logger.exception(error, 'Profile update failed', {
      userId: user.id,
      intent,
    })

    return data(
      {
        errors: {
          _form: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>()

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account information
        </p>
      </div>

      <div className="space-y-6">
        {/* User Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Username
              </label>
              <div className="mt-1 text-sm text-muted-foreground">
                {user.username}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                User ID
              </label>
              <div className="mt-1 text-sm text-muted-foreground font-mono">
                {user.id}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Account Created
              </label>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatDate(user.createdAt)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground">
                Last Updated
              </label>
              <div className="mt-1 text-sm text-muted-foreground">
                {formatDate(user.updatedAt)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Email Card */}
        <UpdateEmailForm />

        {/* Change Password Card */}
        <ChangePasswordForm username={user.username} />

        {/* Bookmarklet Section */}
        <BookmarkletSection user={user} />
      </div>
    </div>
  )
}
