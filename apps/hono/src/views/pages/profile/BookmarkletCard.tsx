import type { FC } from 'hono/jsx'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@pinsquirrel/ui'

/**
 * The drag-to-your-bookmarks-bar pin button.
 *
 * The link's `href` is a `javascript:` bookmarklet that has to be built in the
 * browser, because it embeds the origin the page was served from. That builder
 * lives in /static/bookmarklet.js.
 */
export const BookmarkletCard: FC = () => (
  <Card>
    <CardHeader>
      <CardTitle>Quick Pin Bookmarklet</CardTitle>
    </CardHeader>
    <CardContent class="space-y-4">
      <p class="text-sm text-muted-foreground">
        Drag the bookmarklet below to your bookmarks bar to quickly pin any
        webpage you're visiting.
      </p>

      <div class="bg-muted rounded-lg p-4 border-2 border-dashed border-muted-foreground/25">
        <div class="text-center">
          {/* href is set by /static/bookmarklet.js */}
          <a
            id="bookmarklet-link"
            href="#"
            class="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-move select-none"
            draggable={true}
          >
            📌 Pin to PinSquirrel
          </a>
        </div>
        <p class="text-xs text-muted-foreground text-center mt-2">
          ← Drag this to your bookmarks bar
        </p>
      </div>

      <div class="space-y-2 text-sm text-muted-foreground">
        <h3 class="font-medium text-foreground">How to use:</h3>
        <ol class="list-decimal list-inside space-y-1 ml-4">
          <li>Drag the bookmarklet above to your browser's bookmarks bar</li>
          <li>Navigate to any webpage you want to pin</li>
          <li>
            Click the bookmarklet while on any webpage to open a new tab with
            the pin creation form pre-filled
          </li>
          <li>
            If you have text selected on the page, it will be used as the
            description (converted from HTML to markdown)
          </li>
          <li>Review and save your pin</li>
        </ol>
      </div>

      <Alert variant="info">
        <AlertTitle>Tip</AlertTitle>
        <AlertDescription>
          Select text on a webpage before clicking the bookmarklet to use that
          text as your pin's description. The selected text will be converted to
          markdown format automatically.
        </AlertDescription>
      </Alert>

      <script src="/static/bookmarklet.js" defer></script>
    </CardContent>
  </Card>
)
