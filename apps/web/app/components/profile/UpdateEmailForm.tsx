import { useFetcher } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import type { FieldErrors } from '@pinsquirrel/domain'

interface UpdateEmailFormProps {
  // Optional success callback for parent component to handle success
  onSuccess?: () => void
}

export function UpdateEmailForm({ onSuccess }: UpdateEmailFormProps) {
  const emailFetcher = useFetcher<{
    errors?: FieldErrors
    success?: string
    field?: string
  }>()

  // Handle successful email update
  if (
    emailFetcher.data?.success &&
    emailFetcher.data?.field === 'email' &&
    onSuccess
  ) {
    onSuccess()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Email</CardTitle>
      </CardHeader>
      <CardContent>
        <emailFetcher.Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-email" />

          {emailFetcher.data?.errors?._form && (
            <div className="p-3 text-sm text-black bg-red-400 border-4 border-foreground neobrutalism-shadow font-bold uppercase">
              {Array.isArray(emailFetcher.data.errors._form)
                ? emailFetcher.data.errors._form.join('. ')
                : emailFetcher.data.errors._form}
            </div>
          )}

          {emailFetcher.data?.success &&
            emailFetcher.data?.field === 'email' && (
              <div className="p-3 text-sm text-black bg-lime-300 border-4 border-foreground neobrutalism-shadow font-bold uppercase">
                {emailFetcher.data.success}
              </div>
            )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1"
            >
              New Email Address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className={
                emailFetcher.data?.errors?.email ? 'border-red-500' : ''
              }
              placeholder="Enter new email address"
            />
            {emailFetcher.data?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">
                {Array.isArray(emailFetcher.data.errors.email)
                  ? emailFetcher.data.errors.email.join('. ')
                  : emailFetcher.data.errors.email}
              </p>
            )}
          </div>

          <Button type="submit" disabled={emailFetcher.state === 'submitting'}>
            {emailFetcher.state === 'submitting'
              ? 'Updating...'
              : 'Update Email'}
          </Button>
        </emailFetcher.Form>
      </CardContent>
    </Card>
  )
}
