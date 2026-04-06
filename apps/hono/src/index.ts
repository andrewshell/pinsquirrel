import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { logger } from './lib/logger.js'

const port = Number(process.env.PORT) || 8100

logger.info({ port }, 'Starting Hono server')

serve({
  fetch: app.fetch,
  port,
})

logger.info({ port }, 'Hono server is running')
