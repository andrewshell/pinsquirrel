import { Link, redirect } from 'react-router'
import type { Route } from './+types/register'
import { AuthenticationServiceImpl } from '@pinsquirrel/core'
import { DrizzleUserRepository, db } from '@pinsquirrel/database'
import { createUserSession, getUserId } from '~/lib/session.server'
import { RegisterForm } from '~/components/auth/RegisterForm'
import { registerSchema, parseFormData } from '~/lib/validation'

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
  const result = await parseFormData(request, registerSchema)

  if (!result.success) {
    return {
      errors: result.errors,
    }
  }

  try {
    const user = await authService.register(
      result.data.username,
      result.data.password,
      result.data.email || undefined
    )

    // Create session and redirect
    return await createUserSession(user.id, '/')
  } catch (error) {
    console.error('Registration error:', error)
    const message =
      error instanceof Error ? error.message : 'Registration failed'
    return {
      errors: {
        _form: message,
      },
    }
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
            to="/login"
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
