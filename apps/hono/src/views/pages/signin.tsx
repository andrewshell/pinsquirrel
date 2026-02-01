import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'
import {
  FlashMessage,
  SuccessMessage,
  ErrorMessage,
} from '../components/FlashMessage'
import type { FlashType } from '../../middleware/session'

interface SignInPageProps {
  errors?: Record<string, string[]>
  showResetSuccess?: boolean
  redirectTo?: string | null
  username?: string
  keepSignedIn?: boolean
  flash?: { type: FlashType; message: string } | null
}

export const SignInPage: FC<SignInPageProps> = ({
  errors,
  showResetSuccess,
  redirectTo,
  username = '',
  keepSignedIn = true,
  flash,
}) => {
  return (
    <BaseLayout title="Sign In">
      <div class="min-h-screen flex flex-col items-center justify-center px-4">
        <div class="w-full max-w-md">
          {/* Header */}
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold">Welcome Back, Digital Hoarder</h1>
            <p class="mt-2 text-muted-foreground">
              Or{' '}
              <a
                href="/signup"
                class="text-primary hover:underline font-medium"
              >
                join the gang
              </a>
            </p>
          </div>

          {/* Password reset success message */}
          {showResetSuccess && (
            <SuccessMessage
              message="Your password has been reset successfully. You can now sign in with your new password."
              className="mb-4"
            />
          )}

          {/* Flash message */}
          {flash && (
            <FlashMessage
              type={flash.type}
              message={flash.message}
              className="mb-4"
            />
          )}

          {/* Sign In Card */}
          <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
            <h2 class="text-xl font-bold mb-4">Sign In</h2>

            <form method="post" action="/signin" class="space-y-4" novalidate>
              {/* Hidden redirect field */}
              {redirectTo && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
              )}

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
                  <p class="text-sm text-red-600 font-medium">
                    {errors.username.join('. ')}
                  </p>
                )}
              </div>

              {/* Password field */}
              <div class="space-y-2">
                <div class="flex justify-between items-center">
                  <label for="password" class="block text-sm font-medium">
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    class="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  aria-invalid={errors?.password ? 'true' : undefined}
                  class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                         focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                         ${errors?.password ? 'border-red-500' : ''}`}
                />
                {errors?.password && (
                  <p class="text-sm text-red-600 font-medium">
                    {errors.password.join('. ')}
                  </p>
                )}
              </div>

              {/* Keep signed in checkbox */}
              <div class="flex items-center space-x-2">
                <input type="hidden" name="keepSignedIn" value="false" />
                <input
                  id="keepSignedIn"
                  name="keepSignedIn"
                  type="checkbox"
                  value="true"
                  checked={keepSignedIn}
                  class="h-4 w-4 border-2 border-foreground bg-background
                         focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <label for="keepSignedIn" class="text-sm">
                  Keep me signed in
                </label>
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
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
}
