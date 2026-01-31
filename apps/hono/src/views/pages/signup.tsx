import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'

interface SignUpPageProps {
  errors?: Record<string, string[]>
  username?: string
  email?: string
  success?: boolean
  message?: string
}

export const SignUpPage: FC<SignUpPageProps> = ({
  errors,
  username = '',
  email = '',
  success = false,
  message,
}) => {
  return (
    <BaseLayout title="Sign Up">
      <div class="min-h-screen flex flex-col items-center justify-center px-4">
        <div class="w-full max-w-md">
          {/* Header */}
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold">Join The Digital Squirrel Gang</h1>
            <p class="mt-2 text-muted-foreground">
              Or{' '}
              <a
                href="/signin"
                class="text-primary hover:underline font-medium"
              >
                welcome back, hoarder
              </a>
            </p>
          </div>

          {/* Sign Up Card */}
          <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
            {success ? (
              // Success state
              <div>
                <h2 class="text-xl font-bold mb-4 text-green-700">
                  Account Created!
                </h2>
                <div class="p-4 text-green-700 bg-green-50 border-2 border-green-200 neobrutalism-shadow mb-4">
                  {message}
                </div>
                <p class="text-muted-foreground mb-4">
                  We've sent you an email with a link to set your password.
                  Check your inbox (and spam folder) and click the link to
                  complete your registration.
                </p>
                <a
                  href="/signin"
                  class="block w-full px-4 py-2 text-center bg-secondary text-secondary-foreground font-medium
                         border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  Go to Sign In
                </a>
              </div>
            ) : (
              // Registration form
              <div>
                <h2 class="text-xl font-bold mb-4">Create Account</h2>

                <form
                  method="post"
                  action="/signup"
                  class="space-y-4"
                  novalidate
                >
                  {/* Form-level errors */}
                  {errors?._form && (
                    <div class="p-3 text-sm text-red-700 bg-red-50 border-2 border-red-200 neobrutalism-shadow">
                      {errors._form.join('. ')}
                    </div>
                  )}

                  {/* Username field */}
                  <div class="space-y-2">
                    <label for="username" class="block text-sm font-medium">
                      Username
                    </label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      aria-invalid={errors?.username ? 'true' : undefined}
                      class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                             ${errors?.username ? 'border-red-500' : ''}`}
                    />
                    {errors?.username && (
                      <p class="text-sm text-red-600 font-medium">
                        {errors.username.join('. ')}
                      </p>
                    )}
                  </div>

                  {/* Email field */}
                  <div class="space-y-2">
                    <label for="email" class="block text-sm font-medium">
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      aria-invalid={errors?.email ? 'true' : undefined}
                      class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                             ${errors?.email ? 'border-red-500' : ''}`}
                    />
                    {errors?.email && (
                      <p class="text-sm text-red-600 font-medium">
                        {errors.email.join('. ')}
                      </p>
                    )}
                    <p class="text-xs text-muted-foreground">
                      We'll send you an email to set your password. We hash your
                      email for privacy.
                    </p>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    class="w-full px-4 py-2 bg-primary text-primary-foreground font-medium
                           border-2 border-foreground neobrutalism-shadow
                           hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                           active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Account
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
