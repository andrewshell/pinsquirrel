import { Link, redirect, data } from 'react-router'
import type { Route } from './+types/signup'
import { ValidationError, UserAlreadyExistsError } from '@pinsquirrel/domain'
import { authService } from '~/lib/services/container.server'
import { createUserSession, getUserId } from '~/lib/session.server'
import { getUserPath } from '~/lib/auth.server'
import { RegisterForm } from '~/components/auth/RegisterForm'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Join The Digital Squirrel Gang - PinSquirrel' },
    {
      name: 'description',
      content:
        'Ready to embrace your inner link hoarder? Join the gang and start building your magnificent digital nest.',
    },
  ]
}

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

  try {
    const user = await authService.registerFromFormData(formData)

    logger.info('User registration successful', {
      userId: user.id,
      username: user.username,
    })

    // Create session and redirect to user's pins
    const redirectTo = getUserPath(user.username)
    return await createUserSession(user.id, redirectTo)
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.debug('Registration validation failed', { errors: error.fields })
      return data({ errors: error.fields }, { status: 400 })
    }

    if (error instanceof UserAlreadyExistsError) {
      logger.debug('Registration failed - user already exists')
      return data(
        {
          errors: {
            username: ['This username is already taken'],
          },
        },
        { status: 400 }
      )
    }

    logger.exception(error, 'Registration failed')
    return data(
      {
        errors: {
          _form: 'An unexpected error occurred. Please try again.',
        },
      },
      { status: 500 }
    )
  }
}

export default function RegisterPage() {
  return (
    <div className="sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Join The Digital Squirrel Gang
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link
            to="/signin"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            welcome back, hoarder
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <RegisterForm />
      </div>
    </div>
  )
}
