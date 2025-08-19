import { useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

interface User {
  username: string
}

interface BookmarkletSectionProps {
  user: User
}

export function BookmarkletSection({ user }: BookmarkletSectionProps) {
  const bookmarkletRef = useRef<HTMLAnchorElement>(null)

  // Generate bookmarklet JavaScript code
  const generateBookmarkletCode = useCallback(() => {
    // Get the current app's origin (will be localhost:8100 in dev, production domain in prod)
    const appOrigin =
      typeof window !== 'undefined' ? window.location.origin : ''

    // Build JavaScript code string manually to avoid template literal escaping issues
    const jsCode = [
      '(function() {',
      '  const url = location.href;',
      '  const title = document.title;',
      '  const metaDesc = document.querySelector("meta[name=\\"description\\"]");',
      '  const pageDescription = metaDesc ? metaDesc.getAttribute("content") : "";',
      '  ',
      '  const selection = window.getSelection().toString();',
      '  let description = "";',
      '  ',
      '  if (selection.trim()) {',
      '    description = selection',
      '      .replace(/<br\\s*\\/?>/gi, "\\n")',
      '      .replace(/<\\/p>/gi, "\\n\\n")',
      '      .replace(/<p[^>]*>/gi, "")',
      '      .replace(/<strong[^>]*>(.*?)<\\/strong>/gi, "**$1**")',
      '      .replace(/<b[^>]*>(.*?)<\\/b>/gi, "**$1**")',
      '      .replace(/<em[^>]*>(.*?)<\\/em>/gi, "*$1*")',
      '      .replace(/<i[^>]*>(.*?)<\\/i>/gi, "*$1*")',
      '      .replace(/<a[^>]*href=\\"([^\\"]*)\\"[^>]*>(.*?)<\\/a>/gi, "[$2]($1)")',
      '      .replace(/<[^>]*>/g, "")',
      '      .trim();',
      '  } else {',
      '    description = pageDescription;',
      '  }',
      '  ',
      '  const params = new URLSearchParams({',
      '    url: url,',
      '    title: title,',
      '    description: description',
      '  });',
      '  ',
      `  const targetUrl = "${appOrigin}/${user.username}/pins/new?" + params.toString();`,
      '  window.open(targetUrl, "_blank");',
      '})();',
    ].join(' ')

    return 'javascript:' + encodeURIComponent(jsCode)
  }, [user.username])

  // Set the href using ref after component mounts to bypass React's security restriction
  useEffect(() => {
    if (bookmarkletRef.current) {
      bookmarkletRef.current.setAttribute('href', generateBookmarkletCode())
    }
  }, [generateBookmarkletCode])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Pin Bookmarklet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          <p className="mb-3">
            Drag the bookmarklet below to your bookmarks bar to quickly pin any
            webpage you&apos;re visiting.
          </p>
        </div>

        <div className="bg-muted rounded-lg p-4 border-2 border-dashed border-muted-foreground/25">
          <div className="text-center">
            <a
              ref={bookmarkletRef}
              href="#"
              className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors cursor-move select-none"
              draggable={true}
              onClick={e => {
                e.preventDefault()
                alert(
                  'Drag this link to your bookmarks bar instead of clicking it!'
                )
              }}
            >
              📌 Pin to PinSquirrel
            </a>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            ← Drag this to your bookmarks bar
          </p>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <h4 className="font-medium text-foreground">How to use:</h4>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>
              Drag the bookmarklet above to your browser&apos;s bookmarks bar
            </li>
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

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Tip:</strong> Select text on a webpage before clicking the
            bookmarklet to use that text as your pin&apos;s description. The
            selected text will be converted to markdown format automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
