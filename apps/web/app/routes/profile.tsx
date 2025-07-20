import { Form, useLoaderData, useActionData } from 'react-router'
import type { Route } from './+types/profile'
import { requireUser } from '~/lib/session.server'
import { AuthenticationServiceImpl } from '@pinsquirrel/core'
import { DrizzleUserRepository, db } from '@pinsquirrel/database'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'

// Server-side authentication service
const userRepository = new DrizzleUserRepository(db)
const authService = new AuthenticationServiceImpl(userRepository)

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request)
  return { user }
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request)
  const formData = await request.formData()
  const intent = formData.get('intent') as string

  try {
    if (intent === 'update-email') {
      const email = formData.get('email') as string

      if (!email || !email.trim()) {
        return {
          error: 'Email is required',
          success: null,
          field: 'email',
        }
      }

      await authService.updateEmail(user.id, email.trim())

      return {
        error: null,
        success: 'Email updated successfully',
        field: 'email',
      }
    }

    if (intent === 'change-password') {
      const currentPassword = formData.get('currentPassword') as string
      const newPassword = formData.get('newPassword') as string

      if (!currentPassword || !newPassword) {
        return {
          error: 'Current password and new password are required',
          success: null,
          field: 'password',
        }
      }

      if (newPassword.length < 6) {
        return {
          error: 'New password must be at least 6 characters',
          success: null,
          field: 'password',
        }
      }

      await authService.changePassword(user.id, currentPassword, newPassword)

      return {
        error: null,
        success: 'Password changed successfully',
        field: 'password',
      }
    }

    return {
      error: 'Invalid action',
      success: null,
      field: null,
    }
  } catch (error) {
    console.error('Profile update error:', error)
    const message = error instanceof Error ? error.message : 'Update failed'
    return {
      error: message,
      success: null,
      field: intent === 'update-email' ? 'email' : 'password',
    }
  }
}

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>()
  const actionData = useActionData<{
    error: string | null
    success: string | null
    field: string | null
  }>()

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
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
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
          <Card>
            <CardHeader>
              <CardTitle>Update Email</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="update-email" />

                {actionData?.field === 'email' && actionData.error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                    {actionData.error}
                  </div>
                )}

                {actionData?.field === 'email' && actionData.success && (
                  <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded">
                    {actionData.success}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    New Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                    placeholder="Enter new email address"
                  />
                </div>

                <Button type="submit">Update Email</Button>
              </Form>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="change-password" />

                {actionData?.field === 'password' && actionData.error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
                    {actionData.error}
                  </div>
                )}

                {actionData?.field === 'password' && actionData.success && (
                  <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded">
                    {actionData.success}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="currentPassword"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                </div>

                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
                  />
                  <p className="mt-1 text-sm text-muted-foreground">
                    Must be at least 6 characters
                  </p>
                </div>

                <Button type="submit">Change Password</Button>
              </Form>
            </CardContent>
          </Card>

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
                    Logout
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
