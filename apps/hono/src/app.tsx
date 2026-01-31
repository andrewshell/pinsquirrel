import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

import { BaseLayout } from './views/layouts/base'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { pinsRoutes } from './routes/pins'
import { apiRoutes } from './routes/api'
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
app.route('/pins', pinsRoutes)
app.route('/api', apiRoutes)

// Home page (temporary - will redirect to /pins or /signin)
app.get('/', (c) => {
  return c.html(
    <BaseLayout title="Home">
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
          <h1 class="text-4xl font-bold mb-4">PinSquirrel</h1>
          <p class="text-muted-foreground mb-8">
            Your personal bookmark manager
          </p>
          <div class="space-x-4">
            <a
              href="/signin"
              class="inline-block px-6 py-3 bg-primary text-primary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                     hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all"
            >
              Sign In
            </a>
            <a
              href="/signup"
              class="inline-block px-6 py-3 bg-secondary text-secondary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                     hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all"
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>
    </BaseLayout>
  )
})

export { app }
