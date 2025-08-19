import { Link, redirect, data } from 'react-router'
import type { Route } from './+types/signin'
import { validateLogin } from '@pinsquirrel/core'
import { authService } from '~/lib/services/container.server'
import { createUserSession, getUserId } from '~/lib/session.server'
import { getUserPath } from '~/lib/auth.server'
import { LoginForm } from '~/components/auth/LoginForm'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Welcome Back, Digital Hoarder - PinSquirrel' },
    {
      name: 'description',
      content:
        'Time to dive back into your magnificent collection of internet treasures. Your digital stash awaits.',
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request)
  if (userId) {
    // Already logged in, redirect to home
    return redirect('/')
  }

  // Check for password reset success
  const url = new URL(request.url)
  const reset = url.searchParams.get('reset')
  const showResetSuccess = reset === 'success'

  return data({ showResetSuccess })
}

export async function action({ request }: Route.ActionArgs) {
  logger.request(request, { action: 'login' })

  const formData = await parseFormData(request)
  const result = validateLogin(formData)

  if (!result.success) {
    logger.debug('Login validation failed', { errors: result.errors })
    return data({ errors: result.errors }, { status: 400 })
  }

  try {
    const user = await authService.login(
      result.data.username,
      result.data.password
    )

    logger.info('User login successful', {
      userId: user.id,
      username: user.username,
    })

    // Create session and redirect to user's pins
    const redirectTo = getUserPath(user.username)
    return await createUserSession(
      user.id,
      redirectTo,
      result.data.keepSignedIn
    )
  } catch (error) {
    logger.exception(error, 'Login failed', {
      username: result.data.username,
    })
    const message = error instanceof Error ? error.message : 'Login failed'
    return data(
      {
        errors: {
          _form: message,
        },
      },
      { status: 400 }
    )
  }
}

export default function LoginPage({ loaderData }: Route.ComponentProps) {
  return (
    <div className="bg-background py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Welcome Back, Digital Hoarder
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            to="/signup"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            join the gang
          </Link>
        </p>
      </div>

      {loaderData?.showResetSuccess && (
        <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded">
            Your password has been reset successfully. You can now sign in with
            your new password.
          </div>
        </div>
      )}

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
