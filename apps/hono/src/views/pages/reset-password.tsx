import type { FC } from 'hono/jsx'
import { BaseLayout } from '../layouts/base'

interface ResetPasswordPageProps {
  token?: string
  invalidToken?: boolean
  errors?: Record<string, string[]>
}

export const ResetPasswordPage: FC<ResetPasswordPageProps> = ({
  token,
  invalidToken = false,
  errors,
}) => {
  return (
    <BaseLayout title="Reset Password">
      <div class="min-h-screen flex flex-col items-center justify-center px-4">
        <div class="w-full max-w-md">
          {/* Header */}
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold">Reset Your Password</h1>
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

          {/* Reset Password Card */}
          <div class="bg-card border-2 border-foreground neobrutalism-shadow p-6">
            {invalidToken ? (
              // Invalid or expired token state
              <div>
                <h2 class="text-xl font-bold mb-4 text-red-700">
                  Invalid or Expired Link
                </h2>
                <div class="p-4 text-red-700 bg-red-50 border-2 border-red-200 neobrutalism-shadow mb-4">
                  This password reset link is invalid or has expired.
                </div>
                <p class="text-muted-foreground mb-4">
                  Password reset links expire after 15 minutes for security.
                  Please request a new one.
                </p>
                <a
                  href="/forgot-password"
                  class="block w-full px-4 py-2 text-center bg-primary text-primary-foreground font-medium
                         border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  Request New Link
                </a>
              </div>
            ) : (
              // Reset password form
              <div>
                <h2 class="text-xl font-bold mb-4">Set New Password</h2>
                <p class="text-muted-foreground mb-4">
                  Enter your new password below. Make sure it's at least 8
                  characters long.
                </p>

                <form
                  method="post"
                  action={`/reset-password/${token}`}
                  class="space-y-4"
                  novalidate
                >
                  {/* Form-level errors */}
                  {errors?._form && (
                    <div class="p-3 text-sm text-red-700 bg-red-50 border-2 border-red-200 neobrutalism-shadow">
                      {errors._form.join('. ')}
                    </div>
                  )}

                  {/* New Password field */}
                  <div class="space-y-2">
                    <label for="newPassword" class="block text-sm font-medium">
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type="password"
                      required
                      aria-invalid={errors?.newPassword ? 'true' : undefined}
                      class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                             ${errors?.newPassword ? 'border-red-500' : ''}`}
                    />
                    {errors?.newPassword && (
                      <p class="text-sm text-red-600 font-medium">
                        {errors.newPassword.join('. ')}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password field */}
                  <div class="space-y-2">
                    <label
                      for="confirmPassword"
                      class="block text-sm font-medium"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      aria-invalid={
                        errors?.confirmPassword ? 'true' : undefined
                      }
                      class={`w-full px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                             focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                             ${errors?.confirmPassword ? 'border-red-500' : ''}`}
                    />
                    {errors?.confirmPassword && (
                      <p class="text-sm text-red-600 font-medium">
                        {errors.confirmPassword.join('. ')}
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
                    Reset Password
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
