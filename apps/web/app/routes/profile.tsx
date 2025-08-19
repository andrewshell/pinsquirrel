import { useLoaderData, data, Form } from 'react-router'
import type { Route } from './+types/profile'
import { requireUser } from '~/lib/session.server'
import {
  InvalidCredentialsError,
  validateEmailUpdate,
  validatePasswordChange,
} from '@pinsquirrel/core'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { UpdateEmailForm } from '~/components/profile/UpdateEmailForm'
import { ChangePasswordForm } from '~/components/profile/ChangePasswordForm'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'

import { authService } from '~/lib/services/container.server'

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
      const result = validateEmailUpdate(formData)

      if (!result.success) {
        return data({ errors: result.errors }, { status: 400 })
      }

      await authService.updateEmail(user.id, result.data.email)

      logger.info('User email updated', {
        userId: user.id,
        hasEmail: true,
      })

      return data({
        success: 'Email updated successfully',
        field: 'email',
      })
    }

    if (intent === 'change-password') {
      const result = validatePasswordChange(formData)

      if (!result.success) {
        return data({ errors: result.errors }, { status: 400 })
      }

      try {
        await authService.changePassword(
          user.id,
          result.data.currentPassword,
          result.data.newPassword
        )

        logger.info('User password changed', {
          userId: user.id,
        })

        return data({
          success: 'Password changed successfully',
          field: 'password',
        })
      } catch (error) {
        // Handle specific authentication errors
        if (error instanceof InvalidCredentialsError) {
          return data(
            {
              errors: {
                currentPassword: 'Current password is incorrect',
              },
            },
            { status: 400 }
          )
        }

        // Handle validation errors from the service
        if (
          error instanceof Error &&
          error.message.includes('Invalid new password')
        ) {
          return data(
            {
              errors: {
                newPassword: 'Password must be at least 8 characters',
              },
            },
            { status: 400 }
          )
        }

        // Re-throw to be caught by outer catch block
        throw error
      }
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
    logger.exception(error, 'Profile update failed', {
      userId: user.id,
      intent,
    })
    const message = error instanceof Error ? error.message : 'Update failed'
    return data(
      {
        errors: {
          _form: message,
        },
      },
      { status: 400 }
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
    <div className="bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
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

          {/* Account Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <Button variant="outline" asChild>
                  <a href="/">Back to Home</a>
                </Button>
                <Form method="post" action="/logout">
                  <Button variant="destructive" type="submit">
                    Sign Out
                  </Button>
                </Form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
