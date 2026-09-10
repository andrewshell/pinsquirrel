import type { FC } from 'hono/jsx'
import { Card, CardHeader, CardTitle, CardContent } from '@pinsquirrel/ui'
import { EmbedLayout } from '../layouts/embed'
import { FlashMessage } from '../components/FlashMessage'
import type { FlashType } from '../../middleware/session'

interface EmbedSavedPageProps {
  flash?: { type: FlashType; message: string } | null
  privateMode?: boolean
}

/**
 * Where a save inside the extension's popup window lands.
 *
 * The page only says the window can be closed; it does not try to. A window
 * the extension opened is closed by the extension's worker, which watches for
 * this URL, and a page that was not script-opened cannot reliably close
 * itself anyway.
 */
export const EmbedSavedPage: FC<EmbedSavedPageProps> = ({
  flash,
  privateMode = false,
}) => (
  <EmbedLayout title="Pin saved" privateMode={privateMode}>
    <h1 class="sr-only">Pin saved</h1>
    <Card>
      <CardHeader>
        <CardTitle>Pin saved</CardTitle>
      </CardHeader>
      <CardContent>
        {flash && (
          <FlashMessage
            type={flash.type}
            message={flash.message}
            className="mb-4"
          />
        )}
        <p class="text-sm text-muted-foreground">You can close this window.</p>
      </CardContent>
    </Card>
  </EmbedLayout>
)
