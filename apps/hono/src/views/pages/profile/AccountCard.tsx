import type { User } from '@pinsquirrel/domain'
import type { FC } from 'hono/jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@pinsquirrel/ui'
import { formatDate } from './format-date'

/** Read-only account facts: who you are and when the account changed. */
export const AccountCard: FC<{ user: User }> = ({ user }) => (
  <Card>
    <CardHeader>
      <CardTitle>Account Information</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-foreground">
          Username
        </label>
        <div class="mt-1 text-sm text-muted-foreground">{user.username}</div>
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground">User ID</label>
        <div class="mt-1 text-sm text-muted-foreground font-mono">
          {user.id}
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground">
          Account Created
        </label>
        <div class="mt-1 text-sm text-muted-foreground">
          {formatDate(user.createdAt)}
        </div>
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground">
          Last Updated
        </label>
        <div class="mt-1 text-sm text-muted-foreground">
          {formatDate(user.updatedAt)}
        </div>
      </div>
    </CardContent>
  </Card>
)
