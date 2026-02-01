import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
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
import { sessionMiddleware } from './middleware/session'

// Create the Hono app
const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', secureHeaders())
app.use('*', sessionMiddleware())

// Serve static files
app.use('/static/*', serveStatic({ root: './src' }))

// Routes
app.route('/health', healthRoutes)
app.route('/', authRoutes)
app.route('/', staticRoutes)
app.route('/pins', pinsRoutes)
app.route('/tags', tagsRoutes)
app.route('/profile', profileRoutes)
app.route('/import', importRoutes)
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

// Error handler for 500 errors
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.html(
    <ServerErrorPage message="Something went wrong. Please try again later." />,
    500
  )
})

export { app }
