import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Label,
} from '@pinsquirrel/ui'
import { ErrorMessage } from '../components/FlashMessage'

interface PrivateUnlockPageProps {
  user: User
  error?: string
  /** Where to go once unlocked, when the gate remembered a page. */
  redirectTo?: string
  embed?: boolean
}

export const PrivateUnlockPage: FC<PrivateUnlockPageProps> = ({
  user,
  error,
  redirectTo,
  embed = false,
}) => {
  return (
    <DefaultLayout title="Private Pins" user={user} width="form" embed={embed}>
      {!embed && (
        <div class="mb-6">
          <a
            href="/pins"
            class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            &larr; Back to Pins
          </a>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Private Pins</CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground mb-4">
            Enter your password to view private pins.
          </p>

          {error && <ErrorMessage message={error} />}

          <form method="post" action="/private/unlock" class="space-y-4">
            {redirectTo && (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            )}
            {embed && <input type="hidden" name="embed" value="1" />}
            <div class="space-y-2">
              <Label for="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Enter your password"
              />
            </div>

            <Button type="submit" class="w-full">
              Unlock
            </Button>
          </form>
        </CardContent>
      </Card>
    </DefaultLayout>
  )
}
