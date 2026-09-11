import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { Card, CardHeader, CardTitle, CardContent } from '@pinsquirrel/ui'

/**
 * Where the Chrome extension's authorization lands.
 *
 * The extension registers this URL as its redirect URI and opens the consent
 * screen in an ordinary tab, so password managers work there - Chrome's own
 * `launchWebAuthFlow` window forbids other extensions, which is why the flow
 * moved out of it. The worker reads the code and state off this tab's URL and
 * closes the tab; nothing here touches the code, and the page says only what
 * the person would otherwise see for a fraction of a second, or for longer
 * if the worker was not listening.
 */

interface OAuthExtensionCallbackPageProps {
  user: User | null
  /** The RFC 6749 error the server redirected with, if consent failed. */
  error?: { code: string; description: string }
  embed?: boolean
}

export const OAuthExtensionCallbackPage: FC<
  OAuthExtensionCallbackPageProps
> = ({ user, error, embed = false }) => {
  const title = error ? 'Extension not connected' : 'Extension connected'
  return (
    <DefaultLayout title={title} user={user} width="form" embed={embed}>
      <h1 class="sr-only">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          {error ? (
            <>
              <p class="text-sm text-foreground">{error.description}</p>
              <p class="text-sm text-muted-foreground">
                No access was granted. You can close this tab and try Connect
                again from the extension's options.
              </p>
              <p class="text-xs text-muted-foreground font-mono">
                {error.code}
              </p>
            </>
          ) : (
            <p class="text-sm text-muted-foreground">
              The PinSquirrel extension is finishing up. You can close this tab.
            </p>
          )}
        </CardContent>
      </Card>
    </DefaultLayout>
  )
}
