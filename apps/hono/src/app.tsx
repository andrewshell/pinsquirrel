import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { csrf } from 'hono/csrf'
import { isEmbedRequest } from './lib/embed'
import { logger } from './lib/logger.js'

import { HomePage } from './views/pages/home'
import { DefaultLayout } from './views/layouts/default'
import { getSessionManager } from './middleware/session'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { pinsRoutes } from './routes/pins'
import { tagsRoutes } from './routes/tags'
import { profileRoutes } from './routes/profile'
import { apiInternalRoutes } from './routes/api-internal'
import { apiRoutes } from './routes/api-docs'
import { staticRoutes } from './routes/static'
import { styleRoutes } from './routes/style'
import { importRoutes } from './routes/import'
import { exportRoutes } from './routes/export'
import { privateRoutes } from './routes/private'
import { mcpRoutes } from './routes/mcp'
import { createOAuthMetadataRoutes } from './routes/oauth-metadata'
import { oauthRoutes } from './routes/oauth'
import { oauthTokenRoutes } from './routes/oauth-token'
import { oauthRegisterRoutes } from './routes/oauth-register'
import { seoRoutes } from './routes/seo'
import { oauthConfig } from './lib/config'
import { notFoundResponse, serverErrorResponse } from './lib/error-response'
import { markdownNegotiation } from './middleware/markdown-negotiation'
import { sessionMiddleware } from './middleware/session'
import { securityHeaders } from './middleware/security-headers'

// Create the Hono app
const app = new Hono()

// Middleware
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  logger.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration: Date.now() - start,
    },
    'request'
  )
})
app.use('*', securityHeaders())

// Serve static files (must run before session middleware so CSS/JS load
// even if the database is unavailable)
app.use('/static/*', serveStatic({ root: './src' }))

// SEO endpoints — mounted before session middleware so crawlers can fetch
// them without a database connection.
app.route('/', seoRoutes)

// Markdown content negotiation for the public, agent-relevant pages.
// Honors `Accept: text/markdown` on the same URLs that serve HTML.
app.use('/', markdownNegotiation())
app.use('/privacy', markdownNegotiation())
app.use('/terms', markdownNegotiation())

// OAuth discovery documents — mounted here, before session and CSRF
// middleware, because a client reads them while it is still anonymous. The
// app is the composition root: it reads the base URL and hands the route its
// configuration.
app.route('/', createOAuthMetadataRoutes(oauthConfig))

// The machine-facing OAuth endpoints, mounted here for the same reason: an
// OAuth client posts to them from its own process with no session and no
// browser, so there is nothing for CSRF protection to protect. The consent
// screen is the opposite case and mounts after both, below.
app.route('/oauth', oauthTokenRoutes)
app.route('/oauth', oauthRegisterRoutes)

app.route('/mcp', mcpRoutes)

app.use('*', sessionMiddleware())
app.use('*', csrf())

// Routes
app.route('/health', healthRoutes)
app.route('/', authRoutes)
app.route('/', staticRoutes)
app.route('/', styleRoutes)
app.route('/pins', pinsRoutes)
app.route('/tags', tagsRoutes)
app.route('/profile', profileRoutes)
// The consent screen: a browser form on a signed-in session, so it wants both
// the session middleware and CSRF protection the endpoints above skip.
app.route('/oauth', oauthRoutes)
app.route('/import', importRoutes)
app.route('/export', exportRoutes)
app.route('/private', privateRoutes)
app.route('/api/internal', apiInternalRoutes)
app.route('/api', apiRoutes)

// Home page - redirects logged-in users to /pins
app.get('/', async c => {
  const sessionManager = getSessionManager(c)

  // Redirect logged-in users to their pins page
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  return c.html(
    <DefaultLayout
      title="Hoard your links like winter is coming"
      user={null}
      embed={isEmbedRequest(c)}
    >
      <HomePage />
    </DefaultLayout>
  )
})

// 404 Not Found handler. A program gets JSON and a browser gets the page;
// `lib/error-response` documents why the difference matters.
app.notFound(notFoundResponse)

app.onError(serverErrorResponse)

export { app }
