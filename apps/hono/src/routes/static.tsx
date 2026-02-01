import { Hono } from 'hono'
import { PrivacyPage } from '../views/pages/privacy'
import { TermsPage } from '../views/pages/terms'

const staticPages = new Hono()

// GET /privacy - Privacy policy page
staticPages.get('/privacy', (c) => {
  return c.html(<PrivacyPage />)
})

// GET /terms - Terms of use page
staticPages.get('/terms', (c) => {
  return c.html(<TermsPage />)
})

export { staticPages as staticRoutes }
