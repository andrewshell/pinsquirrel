import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { startExpirySweep } from './lib/expiry-sweep.js'
import { logger } from './lib/logger.js'
import { maintenanceService } from './lib/services.js'

const port = Number(process.env.PORT) || 8100

logger.info({ port }, 'Starting Hono server')

serve({
  fetch: app.fetch,
  port,
})

// Expired sessions and reset tokens are already ignored by every read; this
// is what stops the rows themselves accumulating forever.
startExpirySweep(maintenanceService)

logger.info({ port }, 'Hono server is running')
