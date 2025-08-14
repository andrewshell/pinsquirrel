import { useFetcher } from 'react-router'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import type { FieldErrors } from '~/lib/validation'

export function RegisterForm() {
  const fetcher = useFetcher<{ errors?: FieldErrors }>()

  // Get validation errors and loading state from fetcher
  const actionData = fetcher.data
  const isSubmitting = fetcher.state === 'submitting'

  // Note: Successful registration will redirect automatically via createUserSession

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Sign Up</CardTitle>
      </CardHeader>
      <CardContent>
        <fetcher.Form method="post" className="space-y-4">
          {actionData?.errors?._form && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {actionData.errors._form}
            </div>
          )}

          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium mb-1"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                actionData?.errors?.username
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {actionData?.errors?.username && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                actionData?.errors?.password
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {actionData?.errors?.password && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.password}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email (optional)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                actionData?.errors?.email
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:border-blue-500'
              }`}
            />
            {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.email}
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
