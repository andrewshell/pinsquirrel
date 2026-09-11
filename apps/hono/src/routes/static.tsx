import { Hono } from 'hono'
import { PrivacyPage } from '../views/pages/privacy'
import { TermsPage } from '../views/pages/terms'
import { isEmbedRequest } from '../lib/embed'
import { getSessionManager } from '../middleware/session'

const staticPages = new Hono()

// GET /privacy - Privacy policy page
staticPages.get('/privacy', async c => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()
  return c.html(<PrivacyPage user={user} embed={isEmbedRequest(c)} />)
})

// GET /terms - Terms of use page
staticPages.get('/terms', async c => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()
  return c.html(<TermsPage user={user} embed={isEmbedRequest(c)} />)
})

export { staticPages as staticRoutes }
