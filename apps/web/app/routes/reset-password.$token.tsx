import { Link, redirect, data } from 'react-router'
import type { Route } from './+types/reset-password.$token'
import { authService } from '~/lib/services/container.server'
import { getUserId } from '~/lib/session.server'
import { ResetPasswordForm } from '~/components/auth/ResetPasswordForm'
import { parseFormData } from '~/lib/http-utils'
import { logger } from '~/lib/logger.server'
import { passwordSchema } from '@pinsquirrel/core'

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Reset Password - PinSquirrel' },
    {
      name: 'description',
      content: 'Set a new password for your PinSquirrel account',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const userId = await getUserId(request)
  if (userId) {
    // Already logged in, redirect to home
    return redirect('/')
  }

  const { token } = params
  if (!token) {
    return redirect('/forgot-password')
  }

  // Validate the token
  const isValidToken = await authService.validateResetToken(token)
  if (!isValidToken) {
    logger.info('Invalid or expired reset token accessed', { token })
    return data({ invalidToken: true })
  }

  return data({ token })
}

export async function action({ request, params }: Route.ActionArgs) {
  logger.request(request, { action: 'reset-password' })

  const { token } = params
  if (!token) {
    return redirect('/forgot-password')
  }

  const formData = await parseFormData(request)
  const newPassword = formData.newPassword as string
  const confirmPassword = formData.confirmPassword as string

  // Validate password
  const passwordResult = passwordSchema.safeParse(newPassword)
  if (!passwordResult.success) {
    logger.debug('Invalid password format', { token })
    return data(
      {
        errors: {
          newPassword:
            passwordResult.error.issues[0]?.message || 'Invalid password',
        },
      },
      { status: 400 }
    )
  }

  // Check password confirmation
  if (newPassword !== confirmPassword) {
    return data(
      {
        errors: {
          confirmPassword: 'Passwords do not match',
        },
      },
      { status: 400 }
    )
  }

  try {
    await authService.resetPassword(token, newPassword)

    logger.info('Password reset successful', { token })

    // Redirect to signin with success message
    return redirect('/signin?reset=success')
  } catch (error) {
    logger.exception(error, 'Password reset failed', { token })

    // Check for specific error types
    if (error instanceof Error) {
      if (
        error.message.includes('Invalid') ||
        error.message.includes('expired')
      ) {
        return data({ invalidToken: true })
      }
    }

    return data(
      {
        errors: {
          _form:
            'An error occurred. Please try again or request a new reset link.',
        },
      },
      { status: 500 }
    )
  }
}

export default function ResetPasswordPage({
  loaderData,
}: Route.ComponentProps) {
  // If token is invalid, show error message
  if (loaderData && 'invalidToken' in loaderData && loaderData.invalidToken) {
    return (
      <div className="min-h-screen bg-background py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-600 mb-4">
                Invalid Reset Link
              </h2>
              <p className="text-gray-600 mb-6">
                This password reset link is invalid or has expired.
              </p>
              <Link
                to="/forgot-password"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Reset Your Password
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your new password below
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <ResetPasswordForm
          token={
            loaderData && 'token' in loaderData ? loaderData.token : undefined
          }
        />
      </div>
    </div>
  )
}
