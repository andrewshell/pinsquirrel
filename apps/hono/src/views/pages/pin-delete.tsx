import type { FC } from 'hono/jsx'
import type { Pin, User } from '@pinsquirrel/domain'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@pinsquirrel/ui'
import { withEmbed } from '../../lib/embed'
import { DefaultLayout } from '../layouts/default'

interface PinDeletePageProps {
  user: User
  pin: Pin
  baseUrl?: string
  privateMode?: boolean
  embed?: boolean
}

export const PinDeletePage: FC<PinDeletePageProps> = ({
  user,
  pin,
  baseUrl = '/pins',
  privateMode = false,
  embed = false,
}) => {
  return (
    <DefaultLayout
      title="Delete Pin"
      user={user}
      width="form"
      privateMode={privateMode}
      embed={embed}
    >
      <h1 class="sr-only">Delete Pin</h1>
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
          <Button
            href={withEmbed(baseUrl, embed)}
            variant="outline"
            class="flex-1"
          >
            Cancel
          </Button>
          <form
            method="post"
            action={`${baseUrl}/${pin.id}/delete`}
            class="flex-1"
          >
            {embed && <input type="hidden" name="embed" value="1" />}
            <Button type="submit" variant="destructive" class="w-full">
              Delete Pin
            </Button>
          </form>
        </CardFooter>
      </Card>
    </DefaultLayout>
  )
}
