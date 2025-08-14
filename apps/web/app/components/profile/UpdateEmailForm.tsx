import { useFetcher } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import type { FieldErrors } from '~/lib/validation'

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
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {emailFetcher.data.errors._form}
            </div>
          )}

          {emailFetcher.data?.success &&
            emailFetcher.data?.field === 'email' && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded">
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
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className={`w-full px-3 py-2 border bg-background rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ${
                emailFetcher.data?.errors?.email
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-input focus:border-ring'
              }`}
              placeholder="Enter new email address"
            />
            {emailFetcher.data?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">
                {emailFetcher.data.errors.email}
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
