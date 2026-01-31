import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { metadataService, metadataErrorUtils } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'

const api = new Hono()

// Apply auth middleware to all API routes
api.use('*', requireAuth())

// GET /api/metadata - Fetch metadata for a URL
api.get('/metadata', async (c) => {
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
    // Use the service's error mapping methods
    const statusCode = metadataErrorUtils.getHttpStatusForError(
      error as Error
    ) as ContentfulStatusCode
    const message = metadataErrorUtils.getUserFriendlyMessage(error as Error)

    return c.json({ error: message }, statusCode)
  }
})

export { api as apiRoutes }
