import type { FieldErrors } from '@pinsquirrel/core'
import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export function LoginForm() {
  const fetcher = useFetcher<{ errors?: FieldErrors }>()

  // Get validation errors and loading state from fetcher
  const actionData = fetcher.data
  const isSubmitting = fetcher.state === 'submitting'

  // Note: Successful login will redirect automatically via createUserSession

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="space-y-4" noValidate>
          {actionData?.errors?._form && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {actionData.errors._form}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              {...(actionData?.errors?.username && { 'aria-invalid': true })}
            />
            {actionData?.errors?.username && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {actionData.errors.username}
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
              {...(actionData?.errors?.password && { 'aria-invalid': true })}
            />
            {actionData?.errors?.password && (
              <p className="mt-1 text-sm text-destructive font-medium">
                {actionData.errors.password}
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
