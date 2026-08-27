import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Card, CardHeader, CardTitle, CardContent } from '@pinsquirrel/ui'

/**
 * What an authorization request that failed before anything was trusted looks
 * like to the person in the browser.
 *
 * These failures cannot be redirected. A bad `client_id`, or a `redirect_uri`
 * the client never registered, means there is no address that has been shown
 * to belong to the client, and sending an error to an unvalidated URI is how
 * an open redirector gets built. So the error stops here and the user is told
 * to go back to the application that sent them.
 */

interface OAuthErrorPageProps {
  user: User | null
  /** The RFC 6749 code, shown so a developer can act on it. */
  error: string
  description: string
}

export const OAuthErrorPage: FC<OAuthErrorPageProps> = ({
  user,
  error,
  description,
}) => (
  <DefaultLayout title="Authorization failed" user={user} width="form">
    <Card>
      <CardHeader>
        <CardTitle>Authorization failed</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-foreground">{description}</p>
        <p class="text-sm text-muted-foreground">
          Nothing was shared, and no access was granted. Go back to the
          application that sent you here and start again.
        </p>
        <p class="text-xs text-muted-foreground font-mono">{error}</p>
      </CardContent>
    </Card>
  </DefaultLayout>
)
