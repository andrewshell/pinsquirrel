import type { OAuthGrant } from '@pinsquirrel/services'
import type { FC } from 'hono/jsx'
import { resourceLabel } from '../../../lib/config'
import { Card, CardContent, CardHeader, CardTitle } from '@pinsquirrel/ui'
import { formatDate } from './format-date'

type OAuthGrantsCardProps = {
  grants?: OAuthGrant[]
}

/**
 * The applications a user has given access to, and the way to take it back.
 *
 * One entry per client, whatever it is authorized for: revoking takes every
 * token the client holds, MCP and REST alike, so a row per audience would
 * offer a Revoke button that does more than it says. The row lists what the
 * client can reach instead.
 *
 * No inline script (CSP). A list and a form need none.
 */
export const OAuthGrantsCard: FC<OAuthGrantsCardProps> = ({ grants }) => (
  <Card>
    <CardHeader>
      <CardTitle>Connected Applications</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Applications you have authorized to reach your PinSquirrel data.
        Revoking one signs it out immediately and it has to ask again.
      </p>

      {grants && grants.length > 0 ? (
        <div class="space-y-3">
          {grants.map(grant => (
            <div class="flex items-center justify-between gap-3 p-3 border-2 border-foreground bg-background">
              <div class="space-y-1 min-w-0">
                <div class="text-sm font-medium text-foreground break-all">
                  {/* A client that registered without a name is still
                      something the user has to recognise, so the identifier
                      stands in rather than an empty line. */}
                  {grant.clientName ?? grant.clientId}
                </div>
                <div class="text-xs text-muted-foreground">
                  {grant.resources.map(resourceLabel).join(', ')} ·{' '}
                  {grant.scopes.join(', ')}
                </div>
                <div class="text-xs text-muted-foreground">
                  Authorized {formatDate(grant.createdAt)} · Expires{' '}
                  {formatDate(grant.expiresAt)}
                </div>
              </div>
              <form method="post" action="/profile">
                <input type="hidden" name="intent" value="revoke-oauth-grant" />
                <input type="hidden" name="tokenId" value={grant.tokenId} />
                <button
                  type="submit"
                  class="px-3 py-1 text-sm font-bold border-2 border-foreground bg-destructive text-white neobrutalism-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                >
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <p class="text-sm text-muted-foreground italic">
          You have not authorized any applications yet.
        </p>
      )}
    </CardContent>
  </Card>
)
