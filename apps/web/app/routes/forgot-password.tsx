import { Link, redirect, data } from 'react-router'
import type { Route } from './+types/forgot-password'
import { authService } from '~/lib/services/container.server'
import { getUserId } from '~/lib/session.server'
import { ForgotPasswordForm } from '~/components/auth/ForgotPasswordForm'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'
import { ValidationError } from '@pinsquirrel/domain'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Forgot Password - PinSquirrel' },
    {
      name: 'description',
      content: 'Reset your PinSquirrel password',
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
  logger.request(request, { action: 'forgot-password' })

  const formData = await parseFormData(request)
  const email = formData.email as string

  try {
    // Get the host for the reset URL
    const url = new URL(request.url)
    const resetBaseUrl = `${url.protocol}//${url.host}/reset-password`

    // Request password reset - service handles validation
    const token = await authService.requestPasswordReset({
      email,
      resetUrl: resetBaseUrl,
    })

    if (token) {
      logger.info('Password reset email sent', { email })
    } else {
      logger.info('Password reset requested for non-existent email', { email })
    }

    // Always show success message to avoid revealing whether email exists
    return data({ success: true })
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.debug('Password reset validation failed', { errors: error.fields })
      return data({ errors: error.fields }, { status: 400 })
    }

    logger.exception(error, 'Password reset request failed', { email })

    // Check for rate limiting error
    if (error instanceof Error && error.message.includes('Too many')) {
      return data(
        {
          errors: {
            _form: [
              'Too many password reset requests. Please try again later.',
            ],
          },
        },
        { status: 429 }
      )
    }

    return data(
      {
        errors: {
          _form: ['An error occurred. Please try again later.'],
        },
      },
      { status: 500 }
    )
  }
}

export default function ForgotPasswordPage() {
  return (
    <div className="sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Forgot Your Password?
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Remember it?{' '}
          <Link
            to="/signin"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign in instead
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
