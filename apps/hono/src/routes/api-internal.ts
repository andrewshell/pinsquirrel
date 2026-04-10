import { Hono } from 'hono'
import {
  metadataService,
  metadataErrorUtils,
  pinRepository,
} from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'

const apiInternal = new Hono()

// Apply auth middleware to all API routes
apiInternal.use('*', requireAuth())

// GET /api/internal/metadata - Fetch metadata for a URL
apiInternal.get('/metadata', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

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
    const message = metadataErrorUtils.getUserFriendlyMessage(error as Error)

    return c.json({ error: message })
  }
})

// GET /api/internal/check-url - Check if a URL is already saved
apiInternal.get('/check-url', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(c.req.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return c.json({ error: 'Missing url parameter' }, 400)
  }

  const existingPin = await pinRepository.findByUserIdAndUrl(user.id, targetUrl)

  const exclude = url.searchParams.get('exclude')
  const isDuplicate = existingPin && existingPin.id !== exclude

  const isHtmx = c.req.header('HX-Request') === 'true'

  if (isHtmx) {
    if (isDuplicate) {
      return c.html(
        `<p class="text-sm text-destructive font-medium">This URL is already saved. <a href="/pins/${existingPin.id}/edit" class="underline hover:text-destructive/80">Edit instead?</a></p><script>document.getElementById('url').classList.add('border-red-500')</script>`
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
