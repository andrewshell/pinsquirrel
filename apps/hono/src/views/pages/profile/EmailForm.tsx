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
  errors?: Record<string, string[]>
}

/** Posts `intent=update-email` back to /profile. */
export const EmailForm: FC<EmailFormProps> = ({ errors }) => {
  const formError = errors?._form?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Email</CardTitle>
      </CardHeader>
      <CardContent>
        <form method="post" action="/profile" class="space-y-4">
          <input type="hidden" name="intent" value="update-email" />

          {formError && <ErrorMessage message={formError} />}

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
              class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
                errors?.email ? 'border-red-500' : ''
              }`}
            />
            {errors?.email && (
              <p class="mt-1 text-sm text-destructive">{errors.email[0]}</p>
            )}
          </div>

          <Button type="submit">Update Email</Button>
        </form>
      </CardContent>
    </Card>
  )
}
