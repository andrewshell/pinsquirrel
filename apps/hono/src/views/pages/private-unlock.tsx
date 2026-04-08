import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Label } from '../components/ui/Label'
import { ErrorMessage } from '../components/FlashMessage'

interface PrivateUnlockPageProps {
  user: User
  error?: string
}

export const PrivateUnlockPage: FC<PrivateUnlockPageProps> = ({
  user,
  error,
}) => {
  return (
    <DefaultLayout title="Private Pins" user={user} width="form">
      <div class="mb-6">
        <a
          href="/pins"
          class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          &larr; Back to Pins
        </a>
      </div>

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
