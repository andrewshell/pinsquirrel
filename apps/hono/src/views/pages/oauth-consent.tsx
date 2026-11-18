import type { FC } from 'hono/jsx'
import type { OAuthClient, User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from '@pinsquirrel/ui'

/**
 * The OAuth consent screen.
 *
 * Two things on this page are security properties rather than decoration. The
 * client's name and the host it will be redirected to are shown because a
 * local process claiming to be a known client is otherwise indistinguishable
 * from the real one, and the loopback redirect is exactly where that happens.
 * And the decision travels as a plain form: the app ships `script-src 'self'`,
 * so nothing here may depend on an inline handler.
 *
 * The request itself is carried through as hidden fields and re-validated on
 * POST, so a tampered field is caught by the same checks that rendered this
 * page rather than trusted because it arrived from here.
 */

interface OAuthConsentPageProps {
  user: User
  client: Pick<OAuthClient, 'clientId' | 'clientName' | 'registrationType'>
  /** The host the browser will be sent back to, as the user should read it. */
  redirectHost: string
  redirectUri: string
  scopes: string[]
  resource: string
  /** The authorization request, echoed back as hidden fields. */
  params: Record<string, string | string[]>
  /** Presentation only; travels on its own hidden field, not in `params`. */
  embed?: boolean
}

/** What a scope means, in the terms the user granting it thinks in. */
const SCOPE_DESCRIPTIONS: Record<string, string> = {
  'pins:read': 'Read your bookmarks, including their tags and descriptions',
  'tags:read': 'Read your tags',
  // A pin's tags are pin data and travel under `pins:write`; `tags:write` is
  // about the tag itself (Decision 21). Said this way round so somebody
  // approving a Save button is not asked to agree to merging their tags.
  'pins:write': 'Add, edit and delete your bookmarks',
  'tags:write': 'Merge and delete your tags',
  offline_access: 'Stay connected without asking you again',
}

/**
 * Unicode format characters (Cf), such as bidi overrides and zero-width
 * characters, can reorder or hide part of the registrant's text.
 */
function displayName(client: OAuthConsentPageProps['client']): string {
  const name = client.clientName?.replace(/\p{Cf}/gu, '').trim()
  return name || client.clientId
}

/**
 * A CIMD client is identified by a URL this server fetched its metadata from,
 * so its host is checked even though its name is not.
 */
function provenance(client: OAuthConsentPageProps['client']): string | null {
  if (client.registrationType === 'cimd') {
    return `Published by ${new URL(client.clientId).host}.`
  }
  if (client.registrationType === 'dcr') {
    return 'This name was chosen by the application and is not verified.'
  }
  return null
}

export const OAuthConsentPage: FC<OAuthConsentPageProps> = ({
  user,
  client,
  redirectHost,
  redirectUri,
  scopes,
  resource,
  params,
  embed = false,
}) => (
  <DefaultLayout
    title="Authorize application"
    user={user}
    width="form"
    embed={embed}
  >
    <Card>
      <CardHeader>
        <CardTitle class="wrap-anywhere">
          Authorize {displayName(client)}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">
          <span class="font-bold text-foreground wrap-anywhere">
            {displayName(client)}
          </span>{' '}
          wants access to your PinSquirrel account as{' '}
          <span class="font-bold text-foreground">{user.username}</span>.
        </p>
        {provenance(client) && (
          <p class="text-sm text-muted-foreground">{provenance(client)}</p>
        )}

        <div class="bg-muted p-4 border-2 border-foreground neobrutalism-shadow space-y-2">
          <p class="text-sm font-medium text-foreground">It is asking to:</p>
          <ul class="space-y-1">
            {scopes.map(scope => (
              <li class="text-sm text-foreground">
                <span class="font-mono text-xs">{scope}</span>
                {SCOPE_DESCRIPTIONS[scope] && (
                  <span class="text-muted-foreground">
                    {' '}
                    &mdash; {SCOPE_DESCRIPTIONS[scope]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <dl class="text-sm space-y-1">
          <div>
            <dt class="inline font-medium text-foreground">
              Sends you back to
            </dt>
            <dd class="inline text-muted-foreground">
              {' '}
              <span class="font-bold text-foreground">{redirectHost}</span>{' '}
              <span class="font-mono text-xs break-all">({redirectUri})</span>
            </dd>
          </div>
          <div>
            <dt class="inline font-medium text-foreground">Access to</dt>
            <dd class="inline text-muted-foreground font-mono text-xs break-all">
              {' '}
              {resource}
            </dd>
          </div>
        </dl>

        <p class="text-sm text-muted-foreground">
          Only approve this if you started it. Check the name and the address
          above match the application you are connecting.
        </p>

        <form method="post" action="/oauth/authorize" class="flex gap-3">
          {Object.entries(params).flatMap(([name, value]) =>
            [value]
              .flat()
              .map(one => <input type="hidden" name={name} value={one} />)
          )}
          {embed && <input type="hidden" name="embed" value="1" />}
          <Button type="submit" name="decision" value="approve">
            Approve
          </Button>
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="destructive"
          >
            Deny
          </Button>
        </form>
      </CardContent>
    </Card>
  </DefaultLayout>
)
