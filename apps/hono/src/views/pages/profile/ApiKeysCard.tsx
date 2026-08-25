import type { ApiKey } from '@pinsquirrel/domain'
import type { FC } from 'hono/jsx'
import { SuccessMessage, WarningMessage } from '../../components/FlashMessage'
import { Button } from '../../components/ui/Button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/Card'
import { formatDate } from './format-date'

type ApiKeysCardProps = {
  apiKeys?: ApiKey[]
  newApiKey?: string
  errors?: Record<string, string[]>
}

/**
 * The `ps_` API-key manager. PLAN.md Phase 7c deletes this card along with
 * the key path itself, which is why it is a file of its own.
 */
export const ApiKeysCard: FC<ApiKeysCardProps> = ({
  apiKeys,
  newApiKey,
  errors,
}) => (
  <Card>
    <CardHeader>
      <CardTitle>API Keys</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <p class="text-sm text-muted-foreground">
        API keys allow external applications to access your PinSquirrel data.
        Keep your keys secret — treat them like passwords.
      </p>

      {/* New key display */}
      {newApiKey && (
        <div class="space-y-2">
          <SuccessMessage message="API key created successfully!" />
          <div class="bg-muted p-4 border-2 border-foreground neobrutalism-shadow">
            <p class="text-sm font-medium text-foreground mb-2">
              Your new API key:
            </p>
            <div class="flex items-center gap-2">
              <code
                id="api-key-value"
                class="flex-1 text-sm font-mono bg-background p-2 border-2 border-foreground break-all"
              >
                {newApiKey}
              </code>
              <button
                type="button"
                data-copy-api-key
                class="px-3 py-2 text-sm font-bold border-2 border-foreground bg-primary text-primary-foreground neobrutalism-shadow hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                Copy
              </button>
            </div>
            <WarningMessage
              message="This key will not be shown again. Copy it now and store it securely."
              className="mt-2"
            />
            <script src="/static/api-key-copy.js" defer></script>
          </div>
        </div>
      )}

      {/* Create key form */}
      <form method="post" action="/profile" class="space-y-3">
        <input type="hidden" name="intent" value="create-api-key" />
        <div>
          <label
            for="api-key-name"
            class="block text-sm font-medium text-foreground mb-1"
          >
            Key Name
          </label>
          <input
            id="api-key-name"
            name="name"
            type="text"
            placeholder="e.g., Chrome Extension"
            class={`w-full px-3 py-2 border-2 border-foreground bg-background text-foreground ${
              errors?.name ? 'border-red-500' : ''
            }`}
          />
          {errors?.name && (
            <p class="mt-1 text-sm text-destructive">{errors.name[0]}</p>
          )}
        </div>
        <Button type="submit">Create API Key</Button>
      </form>

      {/* Existing keys list */}
      {apiKeys && apiKeys.length > 0 ? (
        <div class="space-y-3">
          <h3 class="text-sm font-medium text-foreground">Your API Keys</h3>
          {apiKeys.map(key => (
            <div class="flex items-center justify-between p-3 border-2 border-foreground bg-background">
              <div class="space-y-1">
                <div class="text-sm font-medium text-foreground">
                  {key.name}
                </div>
                <div class="text-xs text-muted-foreground font-mono">
                  {key.keyPrefix}...
                </div>
                <div class="text-xs text-muted-foreground">
                  Created {formatDate(key.createdAt)}
                  {key.lastUsedAt && (
                    <span> · Last used {formatDate(key.lastUsedAt)}</span>
                  )}
                </div>
              </div>
              <form method="post" action="/profile">
                <input type="hidden" name="intent" value="revoke-api-key" />
                <input type="hidden" name="keyId" value={key.id} />
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
        !newApiKey && (
          <p class="text-sm text-muted-foreground italic">
            No API keys yet. Create one to get started.
          </p>
        )
      )}
    </CardContent>
  </Card>
)
