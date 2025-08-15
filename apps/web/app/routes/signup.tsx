import { Link, redirect, data } from 'react-router'
import type { Route } from './+types/signup'
import {
  AuthenticationServiceImpl,
  validateRegistration,
} from '@pinsquirrel/core'
import { DrizzleUserRepository, db } from '@pinsquirrel/database'
import { createUserSession, getUserId } from '~/lib/session.server'
import { RegisterForm } from '~/components/auth/RegisterForm'
import { parseFormData } from '~/lib/http-utils'
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
  logger.request(request, { action: 'register' })

  const formData = await parseFormData(request)
  const result = validateRegistration(formData)

  if (!result.success) {
    logger.debug('Registration validation failed', { errors: result.errors })
    return data({ errors: result.errors }, { status: 400 })
  }

  try {
    const user = await authService.register(
      result.data.username,
      result.data.password,
      result.data.email || undefined
    )

    logger.info('User registration successful', {
      userId: user.id,
      username: user.username,
      hasEmail: !!result.data.email,
    })

    // Create session and redirect
    return await createUserSession(user.id, '/')
  } catch (error) {
    logger.exception(error, 'Registration failed', {
      username: result.data.username,
      hasEmail: !!result.data.email,
    })
    const message =
      error instanceof Error ? error.message : 'Registration failed'
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

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            to="/signin"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            sign in to your existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <RegisterForm />
      </div>
    </div>
  )
}
