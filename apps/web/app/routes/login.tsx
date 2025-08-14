import { Link, redirect, data } from 'react-router'
import type { Route } from './+types/login'
import { AuthenticationServiceImpl } from '@pinsquirrel/core'
import { DrizzleUserRepository, db } from '@pinsquirrel/database'
import { createUserSession, getUserId } from '~/lib/session.server'
import { LoginForm } from '~/components/auth/LoginForm'
import { loginSchema, parseFormData } from '~/lib/validation'
import { logger } from '~/lib/logger.server'

// Server-side authentication service
const userRepository = new DrizzleUserRepository(db)
const authService = new AuthenticationServiceImpl(userRepository)

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request)
  if (userId) {
    // Already logged in, redirect to home
    return redirect('/')
  }
  return null
}

export async function action({ request }: Route.ActionArgs) {
  logger.request(request, { action: 'login' })

  const result = await parseFormData(request, loginSchema)

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

    // Create session and redirect
    return await createUserSession(user.id, '/')
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

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            to="/register"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <LoginForm />
      </div>
    </div>
  )
}
