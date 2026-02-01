import type { FC } from 'hono/jsx'
import type { Pin, User } from '@pinsquirrel/domain'
import { Button } from '../components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/Card'
import { DefaultLayout } from '../layouts/default'

interface PinDeletePageProps {
  user: User
  pin: Pin
}

export const PinDeletePage: FC<PinDeletePageProps> = ({ user, pin }) => {
  return (
    <DefaultLayout title="Delete Pin" user={user} width="form">
      <Card>
        <CardHeader>
          <CardTitle>Delete Pin</CardTitle>
          <CardDescription>
            Are you sure you want to delete this pin? This action cannot be
            undone.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <h2 class="font-semibold text-lg">{pin.title}</h2>
          <p class="text-sm text-muted-foreground break-all">{pin.url}</p>
        </CardContent>

        <CardFooter class="gap-4">
          <Button href="/pins" variant="outline" class="flex-1">
            Cancel
          </Button>
          <form method="post" action={`/pins/${pin.id}/delete`} class="flex-1">
            <Button type="submit" variant="destructive" class="w-full">
              Delete Pin
            </Button>
          </form>
        </CardFooter>
      </Card>
    </DefaultLayout>
  )
}
