import type { User } from '@pinsquirrel/domain'
import type { FC } from 'hono/jsx'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pinsquirrel/ui'

type PasswordFormProps = {
  user: User
  errors?: Record<string, string[]>
}

/** Posts `intent=change-password` back to /profile. */
export const PasswordForm: FC<PasswordFormProps> = ({ user, errors }) => (
  <Card>
    <CardHeader>
      <CardTitle>Change Password</CardTitle>
    </CardHeader>
    <CardContent>
      <form method="post" action="/profile" class="space-y-4">
        <input type="hidden" name="intent" value="change-password" />
        <input
          type="hidden"
          name="username"
          value={user.username}
          autocomplete="username"
        />

        <div>
          <label
            for="currentPassword"
            class="block text-sm font-medium text-foreground mb-1"
          >
            Current Password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autocomplete="current-password"
            class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
              errors?.currentPassword ? 'border-red-500' : ''
            }`}
          />
          {errors?.currentPassword && (
            <p class="mt-1 text-sm text-destructive">
              {errors.currentPassword[0]}
            </p>
          )}
        </div>

        <div>
          <label
            for="newPassword"
            class="block text-sm font-medium text-foreground mb-1"
          >
            New Password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autocomplete="new-password"
            class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
              errors?.newPassword ? 'border-red-500' : ''
            }`}
          />
          {errors?.newPassword ? (
            <p class="mt-1 text-sm text-destructive">{errors.newPassword[0]}</p>
          ) : (
            <p class="mt-1 text-sm text-muted-foreground">
              Must be at least 12 characters
            </p>
          )}
        </div>

        <Button type="submit">Change Password</Button>
      </form>
    </CardContent>
  </Card>
)
