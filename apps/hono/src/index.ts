import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { staticOAuthClients } from './lib/config.js'
import { startExpirySweep } from './lib/expiry-sweep.js'
import { reconcileStaticClients } from './lib/static-clients.js'
import { logger } from './lib/logger.js'
import {
  deferredWork,
  maintenanceService,
  oauthService,
} from './lib/services.js'

const port = Number(process.env.PORT) || 8100

logger.info({ port }, 'Starting Hono server')

const server = serve({
  fetch: app.fetch,
  port,
})

// Under Docker's default 10-second stop grace period.
const DRAIN_TIMEOUT_MS = 8000

// Sign-up and reset mail runs after the response, so stop taking requests and
// let that work finish before exiting. `once`: a second signal kills at once.
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal, pending: deferredWork.pending }, 'Shutting down')
  server.close()
  const abandoned = await deferredWork.drain(DRAIN_TIMEOUT_MS)
  if (abandoned > 0) {
    logger.error({ abandoned }, 'Abandoned deferred account work at shutdown')
  }
  process.exit(0)
}
process.once('SIGTERM', signal => void shutdown(signal))
process.once('SIGINT', signal => void shutdown(signal))

// Expired sessions and reset tokens are already ignored by every read; this
// is what stops the rows themselves accumulating forever.
startExpirySweep(maintenanceService)

// Clients an operator pre-registered via OAUTH_STATIC_CLIENTS. Reconciled
// here rather than at `lib/services.ts` module load, so importing a service in
// a test does not reach for the database.
if (staticOAuthClients.length > 0) {
  void reconcileStaticClients(oauthService, staticOAuthClients)
}

logger.info({ port }, 'Hono server is running')
