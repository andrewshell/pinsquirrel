import type { FieldErrors } from '@pinsquirrel/core'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function ForgotPasswordForm() {
  const fetcher = useFetcher<{
    errors?: FieldErrors
    success?: boolean
  }>()

  // Get validation errors and loading state from fetcher
  const actionData = fetcher.data
  const isSubmitting = fetcher.state === 'submitting'

  if (actionData?.success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-green-600">
            Check Your Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              If an account with that email exists, we&apos;ve sent password
              reset instructions.
            </p>
            <p className="text-sm text-gray-500">
              Check your email for a link to reset your password. The link will
              expire in 15 minutes.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Forgot Password</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="space-y-4" noValidate>
          {actionData?.errors?._form && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {actionData.errors._form}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="Enter your email address"
              {...(actionData?.errors?.email && { 'aria-invalid': true })}
            />
            {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {actionData.errors.email}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
