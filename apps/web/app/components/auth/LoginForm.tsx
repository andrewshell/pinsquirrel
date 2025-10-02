import type { FieldErrors } from '@pinsquirrel/domain'
import { useFetcher, Link } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

type ActionData = { errors: FieldErrors } | null

interface LoginFormProps {
  redirectTo?: string | null
}

export function LoginForm({ redirectTo }: LoginFormProps = {}) {
  const fetcher = useFetcher<ActionData>()

  // Get validation errors and loading state from fetcher
  const actionData = fetcher.data
  const errors = actionData?.errors
  const isSubmitting = fetcher.state === 'submitting'

  // Note: Successful login will redirect automatically via createUserSession

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="space-y-4" noValidate>
          {redirectTo && (
            <input type="hidden" name="redirectTo" value={redirectTo} />
          )}

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
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Forgot password?
              </Link>
            </div>
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
            {/* Hidden input ensures keepSignedIn is always sent as false when checkbox is unchecked */}
            <input type="hidden" name="keepSignedIn" value="false" />
            <Checkbox
              id="keepSignedIn"
              name="keepSignedIn"
              label="Keep me signed in"
              defaultChecked={true}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </fetcher.Form>
      </CardContent>
    </Card>
  )
}
