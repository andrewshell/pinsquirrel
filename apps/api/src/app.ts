import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import 'dotenv/config'

import { errorHandler } from './middleware/error.js'
import { requestLogger } from './middleware/logger.js'
import { corsMiddleware, securityHeaders, rateLimitMiddleware } from './middleware/security.js'
import health from './routes/health.js'
import api from './routes/api.js'

const app = new Hono()

// Global middleware
app.use(requestLogger)
app.use(corsMiddleware)
app.use(securityHeaders)
app.use(rateLimitMiddleware(100, 60000))

// Error handling
app.onError(errorHandler)

// 404 handler
app.notFound(() => {
  throw new HTTPException(404, { message: 'Not Found' })
})

// Health check routes
app.route('/', health)

// API routes
app.route('/api/v1', api)

// Root route
app.get('/', (c) => {
  return c.json({
    message: 'PinSquirrel API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api/v1'
    }
  })
})

export type AppType = typeof app

export default app
