import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AccessControl } from '@pinsquirrel/domain'
import {
  metadataService,
  metadataErrorUtils,
  pinService,
} from '../lib/services'
import { getAuthUser, requireAuth } from '../middleware/session'

/**
 * The pin form tells us which list it is being used from, so the duplicate
 * notice can offer an "Edit instead?" link that stays inside private mode.
 *
 * It lands in an `href` inside a hand-built HTML string, so only a plain
 * absolute path is accepted — a protocol-relative `//host`, a `javascript:`
 * URL, or an embedded quote all fall back to the public list.
 */
function safeBaseUrl(value: string | null): string {
  return value && /^(\/[A-Za-z0-9_-]+)+$/.test(value) ? value : '/pins'
}

const apiInternal = new Hono()

// Apply auth middleware to all API routes
apiInternal.use('*', requireAuth())

// GET /api/internal/metadata - Fetch metadata for a URL
// Gated by requireAuth above; the handler itself needs no user, it just must
// not be reachable anonymously.
apiInternal.get('/metadata', async c => {
  const url = new URL(c.req.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return c.json({ error: 'Missing url parameter' }, 400)
  }

  try {
    const metadata = await metadataService.fetchMetadata(targetUrl)

    return c.json({
      title: metadata.title || '',
      description: metadata.description || '',
    })
  } catch (error) {
    // Report the failure in the status line, not only in the body: the client
    // should be able to trust `response.ok`.
    const message = metadataErrorUtils.getUserFriendlyMessage(error as Error)
    const status = metadataErrorUtils.getHttpStatusForError(error as Error)

    return c.json({ error: message }, status as ContentfulStatusCode)
  }
})

// GET /api/internal/check-url - Check if a URL is already saved
apiInternal.get('/check-url', async c => {
  const user = getAuthUser(c)

  const url = new URL(c.req.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return c.json({ error: 'Missing url parameter' }, 400)
  }

  const existingPin = await pinService.findByUrl(
    new AccessControl(user),
    targetUrl
  )

  const exclude = url.searchParams.get('exclude')
  const isDuplicate = existingPin && existingPin.id !== exclude

  const isHtmx = c.req.header('HX-Request') === 'true'

  if (isHtmx) {
    if (isDuplicate) {
      const baseUrl = safeBaseUrl(url.searchParams.get('baseUrl'))
      return c.html(
        `<p class="text-sm text-destructive font-medium">This URL is already saved. <a href="${baseUrl}/${existingPin.id}/edit" class="underline hover:text-destructive/80">Edit instead?</a></p><script>document.getElementById('url').classList.add('border-red-500')</script>`
      )
    }
    return c.html(
      `<script>document.getElementById('url').classList.remove('border-red-500')</script>`
    )
  }

  if (isDuplicate) {
    return c.json({ exists: true, pinId: existingPin.id })
  }
  return c.json({ exists: false })
})

export { apiInternal as apiInternalRoutes }
