import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

import { NotFoundPage } from './views/pages/not-found'
import { ServerErrorPage } from './views/pages/server-error'
import { HomePage } from './views/pages/home'
import { DefaultLayout } from './views/layouts/default'
import { getSessionManager } from './middleware/session'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { pinsRoutes } from './routes/pins'
import { tagsRoutes } from './routes/tags'
import { profileRoutes } from './routes/profile'
import { apiRoutes } from './routes/api'
import { staticRoutes } from './routes/static'
import { importRoutes } from './routes/import'
import { exportRoutes } from './routes/export'
import { sessionMiddleware } from './middleware/session'

// Create the Hono app
const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', secureHeaders())

// Serve static files (must run before session middleware so CSS/JS load
// even if the database is unavailable)
app.use('/static/*', serveStatic({ root: './src' }))

app.use('*', sessionMiddleware())
app.use('*', csrf())

// Routes
app.route('/health', healthRoutes)
app.route('/', authRoutes)
app.route('/', staticRoutes)
app.route('/pins', pinsRoutes)
app.route('/tags', tagsRoutes)
app.route('/profile', profileRoutes)
app.route('/import', importRoutes)
app.route('/export', exportRoutes)
app.route('/api', apiRoutes)

// Home page - redirects logged-in users to /pins
app.get('/', async (c) => {
  const sessionManager = getSessionManager(c)

  // Redirect logged-in users to their pins page
  if (sessionManager.isAuthenticated()) {
    return c.redirect('/pins')
  }

  return c.html(
    <DefaultLayout title="Hoard your links like winter is coming" user={null}>
      <HomePage />
    </DefaultLayout>
  )
})

// 404 Not Found handler
app.notFound((c) => {
  return c.html(<NotFoundPage />, 404)
})

// Detect MySQL/network errors coming from mysql2 (possibly nested in `cause`)
function isDatabaseConnectionError(err: unknown): boolean {
  const dbCodes = new Set([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'PROTOCOL_CONNECTION_LOST',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
  ])
  const visited = new Set<unknown>()
  let cur: unknown = err
  while (cur && typeof cur === 'object' && !visited.has(cur)) {
    visited.add(cur)
    const code = (cur as { code?: unknown }).code
    if (typeof code === 'string' && dbCodes.has(code)) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

// Error handler for 500 errors
app.onError((err, c) => {
  console.error('Server error:', err)
  const message = isDatabaseConnectionError(err)
    ? 'Unable to connect to the database. If you are running locally, make sure Docker is running and start the database with `pnpm db:up`.'
    : 'Something went wrong. Please try again later.'
  return c.html(<ServerErrorPage message={message} />, 500)
})

export { app }
