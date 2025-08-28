import { useFetcher } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { FormText } from '~/components/ui/form-text'
import type { FieldErrors } from '@pinsquirrel/domain'

interface ChangePasswordFormProps {
  // Username is needed for the hidden field for password managers
  username: string
  // Optional success callback for parent component to handle success
  onSuccess?: () => void
}

export function ChangePasswordForm({
  username,
  onSuccess,
}: ChangePasswordFormProps) {
  const passwordFetcher = useFetcher<{
    errors?: FieldErrors
    success?: string
    field?: string
  }>()

  // Handle successful password change
  if (
    passwordFetcher.data?.success &&
    passwordFetcher.data?.field === 'password' &&
    onSuccess
  ) {
    onSuccess()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <passwordFetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="change-password" />
          {/* Hidden username field for password managers and accessibility */}
          <input
            hidden
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            readOnly
          />

          {passwordFetcher.data?.errors?._form && (
            <div className="p-3 text-sm text-black bg-red-400 border-4 border-foreground neobrutalism-shadow font-bold uppercase">
              {Array.isArray(passwordFetcher.data.errors._form)
                ? passwordFetcher.data.errors._form.join('. ')
                : passwordFetcher.data.errors._form}
            </div>
          )}

          {passwordFetcher.data?.success &&
            passwordFetcher.data?.field === 'password' && (
              <div className="p-3 text-sm text-black bg-lime-300 border-4 border-foreground neobrutalism-shadow font-bold uppercase">
                {passwordFetcher.data.success}
              </div>
            )}

          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Current Password
            </label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className={
                passwordFetcher.data?.errors?.currentPassword
                  ? 'border-red-500'
                  : ''
              }
            />
            {passwordFetcher.data?.errors?.currentPassword && (
              <p className="mt-1 text-sm text-red-600">
                {Array.isArray(passwordFetcher.data.errors.currentPassword)
                  ? passwordFetcher.data.errors.currentPassword.join('. ')
                  : passwordFetcher.data.errors.currentPassword}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-foreground mb-1"
            >
              New Password
            </label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className={
                passwordFetcher.data?.errors?.newPassword
                  ? 'border-red-500'
                  : ''
              }
            />
            {passwordFetcher.data?.errors?.newPassword ? (
              <FormText variant="error" className="mt-1">
                {Array.isArray(passwordFetcher.data.errors.newPassword)
                  ? passwordFetcher.data.errors.newPassword.join('. ')
                  : passwordFetcher.data.errors.newPassword}
              </FormText>
            ) : (
              <FormText variant="hint" className="mt-1">
                Must be at least 8 characters
              </FormText>
            )}
          </div>

          <Button
            type="submit"
            disabled={passwordFetcher.state === 'submitting'}
          >
            {passwordFetcher.state === 'submitting'
              ? 'Changing...'
              : 'Change Password'}
          </Button>
        </passwordFetcher.Form>
      </CardContent>
    </Card>
  )
}
