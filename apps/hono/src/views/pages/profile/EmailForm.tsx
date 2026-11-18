import type { User } from '@pinsquirrel/domain'
import type { FC } from 'hono/jsx'
import { ErrorMessage } from '../../components/FlashMessage'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pinsquirrel/ui'

type EmailFormProps = {
  user: User
  errors?: Record<string, string[]>
  /** Carried on a hidden field so a rejected form comes back in embed. */
  embed?: boolean
}

const inputClass = (invalid: boolean) =>
  `w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
    invalid ? 'border-red-500' : ''
  }`

/** Posts `intent=update-email` back to /profile. */
export const EmailForm: FC<EmailFormProps> = ({
  user,
  errors,
  embed = false,
}) => {
  const formError = errors?._form?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Email</CardTitle>
      </CardHeader>
      <CardContent>
        <form method="post" action="/profile" class="space-y-4">
          <input type="hidden" name="intent" value="update-email" />
          {embed && <input type="hidden" name="embed" value="1" />}

          {formError && <ErrorMessage message={formError} />}

          <p class="text-sm text-muted-foreground">
            We send a confirmation link to the new address. Your email changes
            once you follow it.
          </p>

          {user.emailHash && (
            <div>
              <label
                for="currentEmail"
                class="block text-sm font-medium text-foreground mb-1"
              >
                Current Email Address
              </label>
              <input
                id="currentEmail"
                name="currentEmail"
                type="email"
                autocomplete="email"
                class={inputClass(false)}
              />
              <p class="mt-1 text-sm text-muted-foreground">
                We tell this address about the change.
              </p>
            </div>
          )}

          <div>
            <label
              for="email"
              class="block text-sm font-medium text-foreground mb-1"
            >
              New Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autocomplete="email"
              placeholder="Enter new email address"
              class={inputClass(Boolean(errors?.email))}
            />
            {errors?.email && (
              <p class="mt-1 text-sm text-destructive">{errors.email[0]}</p>
            )}
          </div>

          <div>
            <label
              for="emailPassword"
              class="block text-sm font-medium text-foreground mb-1"
            >
              Current Password
            </label>
            <input
              id="emailPassword"
              name="emailPassword"
              type="password"
              autocomplete="current-password"
              class={inputClass(Boolean(errors?.emailPassword))}
            />
            {errors?.emailPassword && (
              <p class="mt-1 text-sm text-destructive">
                {errors.emailPassword[0]}
              </p>
            )}
          </div>

          <Button type="submit">Update Email</Button>
        </form>
      </CardContent>
    </Card>
  )
}
