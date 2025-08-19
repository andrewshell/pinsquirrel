import type { FieldErrors } from '@pinsquirrel/core'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

interface ResetPasswordFormProps {
  token?: string
}

export function ResetPasswordForm({ token: _token }: ResetPasswordFormProps) {
  const fetcher = useFetcher<{
    errors?: FieldErrors
    invalidToken?: boolean
  }>()

  // Get validation errors and loading state from fetcher
  const actionData = fetcher.data
  const isSubmitting = fetcher.state === 'submitting'

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="space-y-4" noValidate>
          {actionData?.errors?._form && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {actionData.errors._form}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              placeholder="Enter your new password"
              {...(actionData?.errors?.newPassword && { 'aria-invalid': true })}
            />
            {actionData?.errors?.newPassword && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {actionData.errors.newPassword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              placeholder="Confirm your new password"
              {...(actionData?.errors?.confirmPassword && {
                'aria-invalid': true,
              })}
            />
            {actionData?.errors?.confirmPassword && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {actionData.errors.confirmPassword}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
