import type { FC } from 'hono/jsx'
import type { User } from '@pinsquirrel/domain'
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
  /** The client's own name, or its identifier when it published none. */
  clientLabel: string
  /** The host the browser will be sent back to, as the user should read it. */
  redirectHost: string
  redirectUri: string
  scopes: string[]
  resource: string
  /** The authorization request, echoed back as hidden fields. */
  params: Record<string, string>
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

export const OAuthConsentPage: FC<OAuthConsentPageProps> = ({
  user,
  clientLabel,
  redirectHost,
  redirectUri,
  scopes,
  resource,
  params,
}) => (
  <DefaultLayout title="Authorize application" user={user} width="form">
    <Card>
      <CardHeader>
        <CardTitle>Authorize {clientLabel}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">
          <span class="font-bold text-foreground">{clientLabel}</span> wants
          access to your PinSquirrel account as{' '}
          <span class="font-bold text-foreground">{user.username}</span>.
        </p>

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
          {Object.entries(params).map(([name, value]) => (
            <input type="hidden" name={name} value={value} />
          ))}
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
