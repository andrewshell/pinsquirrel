import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'
import { SuccessMessage, ErrorMessage } from '../components/FlashMessage'

interface ForgotPasswordPageProps {
  errors?: Record<string, string[]>
  email?: string
  success?: boolean
}

export const ForgotPasswordPage: FC<ForgotPasswordPageProps> = ({
  errors,
  email = '',
  success = false,
}) => {
  return (
    <BaseLayout title="Forgot Password">
      <div class="min-h-screen flex flex-col items-center justify-center px-4">
        <div class="w-full max-w-md">
          {/* Header */}
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold">Forgot Your Password?</h1>
            <p class="mt-2 text-muted-foreground">
              Remember it?{' '}
              <a
                href="/signin"
                class="text-primary hover:underline font-medium"
              >
                Sign in instead
              </a>
            </p>
          </div>

          {/* Forgot Password Card */}
          <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
            {success ? (
              // Success state
              <div>
                <h2 class="text-xl font-bold mb-4 text-green-700 dark:text-green-300">
                  Check Your Email
                </h2>
                <SuccessMessage
                  message="If an account exists with that email address, we've sent instructions to reset your password."
                  className="mb-4"
                />
                <p class="text-muted-foreground mb-4">
                  Check your inbox (and spam folder) for the password reset
                  link. The link will expire in 15 minutes.
                </p>
                <a
                  href="/signin"
                  class="block w-full px-4 py-2 text-center bg-secondary text-secondary-foreground font-medium
                         border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  Back to Sign In
                </a>
              </div>
            ) : (
              // Request form
              <div>
                <h2 class="text-xl font-bold mb-4">Reset Password</h2>
                <p class="text-muted-foreground mb-4">
                  Enter your email address and we'll send you a link to reset
                  your password.
                </p>

                <form
                  method="post"
                  action="/forgot-password"
                  class="space-y-4"
                  novalidate
                >
                  {/* Form-level errors */}
                  {errors?._form && (
                    <ErrorMessage message={errors._form.join('. ')} />
                  )}

                  {/* Email field */}
                  <div class="space-y-2">
                    <label for="email" class="block text-sm font-medium">
                      Email Address
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
                    Send Reset Link
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
