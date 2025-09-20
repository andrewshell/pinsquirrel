import type { FieldErrors } from '@pinsquirrel/domain'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type ActionData =
  | { errors: FieldErrors }
  | { success: boolean; message: string }
  | null

export function RegisterForm() {
  const fetcher = useFetcher<ActionData>()

  // Get validation errors, success data, and loading state from fetcher
  const actionData = fetcher.data
  const errors =
    actionData && 'errors' in actionData ? actionData.errors : undefined
  const success = actionData && 'success' in actionData ? actionData : undefined
  const isSubmitting = fetcher.state === 'submitting'

  // Note: Successful registration will show email verification instructions

  // Show success message if registration was successful
  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Account Created!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded">
            {success.message}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <button
              onClick={() => window.location.reload()}
              className="text-primary hover:underline"
            >
              try again
            </button>
            .
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign Up</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="space-y-4" noValidate>
          {errors?._form && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {Array.isArray(errors._form)
                ? errors._form.join('. ')
                : errors._form}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              {...(errors?.username && { 'aria-invalid': true })}
            />
            {errors?.username && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {Array.isArray(errors.username)
                  ? errors.username.join('. ')
                  : errors.username}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              {...(errors?.email && { 'aria-invalid': true })}
            />
            {errors?.email && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {Array.isArray(errors.email)
                  ? errors.email.join('. ')
                  : errors.email}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>

          <p className="text-sm text-muted-foreground text-center mt-4">
            After creating your account, check your email to set your password
            and complete registration.
          </p>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
