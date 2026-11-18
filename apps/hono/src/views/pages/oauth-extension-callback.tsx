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
  /** The `error` query parameter, if the authorization failed. */
  error?: string
  embed?: boolean
}

/**
 * What each RFC 6749 4.1.2.1 code (and RFC 8707's `invalid_target`) means to
 * the person connecting. The page shows only these: its URL is anybody's to
 * write, so text from the query string would be a message in the site's name.
 */
const ERROR_MESSAGES = new Map<string, string>([
  [
    'access_denied',
    'You declined the connection, or your session ended first.',
  ],
  [
    'invalid_request',
    'The extension sent a request the server could not accept.',
  ],
  [
    'unauthorized_client',
    'The server does not allow this extension to connect.',
  ],
  [
    'unsupported_response_type',
    'The extension asked for a kind of access the server does not offer.',
  ],
  [
    'invalid_scope',
    'The extension asked for permissions the server does not offer.',
  ],
  [
    'invalid_target',
    'The extension asked for access to something the server does not offer.',
  ],
  ['server_error', 'The server ran into a problem.'],
  ['temporarily_unavailable', 'The server is busy. Try again in a moment.'],
])

const UNKNOWN_ERROR = 'The connection did not complete.'

export const OAuthExtensionCallbackPage: FC<
  OAuthExtensionCallbackPageProps
> = ({ user, error, embed = false }) => {
  const title = error ? 'Extension not connected' : 'Extension connected'
  const known = error ? ERROR_MESSAGES.get(error) : undefined
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
              <p class="text-sm text-foreground">{known ?? UNKNOWN_ERROR}</p>
              <p class="text-sm text-muted-foreground">
                No access was granted. You can close this tab and try Connect
                again from the extension's options.
              </p>
              {known && (
                <p class="text-xs text-muted-foreground font-mono">{error}</p>
              )}
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
