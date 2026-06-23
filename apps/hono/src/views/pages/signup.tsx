import type { FC } from 'hono/jsx'
import { DefaultLayout } from '../layouts/default'
import { SuccessMessage, ErrorMessage } from '../components/FlashMessage'

interface SignUpPageProps {
  errors?: Record<string, string[]>
  username?: string
  email?: string
  success?: boolean
  message?: string
  showResendLink?: boolean
}

export const SignUpPage: FC<SignUpPageProps> = ({
  errors,
  username = '',
  email = '',
  success = false,
  message,
  showResendLink = false,
}) => {
  return (
    <DefaultLayout title="Request Early Access" user={null}>
      <div class="flex flex-col items-center justify-center px-4 py-16">
        <div class="w-full max-w-md">
          {/* Header */}
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold">Join the Early Access Waitlist</h1>
            <p class="mt-2 text-muted-foreground">
              PinSquirrel is opening up to new squirrels in batches. Claim your
              spot and we'll let you in soon.
            </p>
            <p class="mt-2 text-muted-foreground">
              Already in?{' '}
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
                <h2 class="text-xl font-bold mb-4 text-green-700 dark:text-green-300">
                  You're on the list!
                </h2>
                {message && (
                  <SuccessMessage message={message} className="mb-4" />
                )}
                <p class="text-muted-foreground mb-4">
                  {showResendLink
                    ? 'If you don\u2019t receive an email, you can request a new one.'
                    : 'We\u2019ve sent you an email with a link to confirm your spot and set your password. Check your inbox (and spam folder) and click the link. We\u2019re opening access in batches and will let you in soon.'}
                </p>
                {showResendLink && (
                  <a
                    href="/forgot-password"
                    class="block w-full px-4 py-2 mb-4 text-center bg-primary text-primary-foreground font-medium
                           border-2 border-foreground neobrutalism-shadow
                           hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                           active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                           transition-all"
                  >
                    Resend Verification Email
                  </a>
                )}
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
                <h2 class="text-xl font-bold mb-4">Request Early Access</h2>

                <form
                  method="post"
                  action="/signup"
                  class="space-y-4"
                  novalidate
                >
                  {/* Form-level errors */}
                  {errors?._form && (
                    <ErrorMessage message={errors._form.join('. ')} />
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
                      <p class="text-sm text-destructive font-medium">
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
                      <p class="text-sm text-destructive font-medium">
                        {errors.email.join('. ')}
                      </p>
                    )}
                    <p class="text-xs text-muted-foreground">
                      We'll email you a link to confirm your spot and set your
                      password. We hash your email for privacy.
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
                    Request Early Access
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </DefaultLayout>
  )
}
