import type { FieldErrors } from '@pinsquirrel/domain'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type ActionData = { errors: FieldErrors } | null

export function RegisterForm() {
  const fetcher = useFetcher<ActionData>()

  // Get validation errors and loading state from fetcher
  const actionData = fetcher.data
  const errors = actionData?.errors
  const isSubmitting = fetcher.state === 'submitting'

  // Note: Successful registration will redirect automatically via createUserSession

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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              {...(errors?.password && { 'aria-invalid': true })}
            />
            {errors?.password && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {Array.isArray(errors.password)
                  ? errors.password.join('. ')
                  : errors.password}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              name="email"
              type="email"
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
            {isSubmitting ? 'Creating account...' : 'Sign Up'}
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
