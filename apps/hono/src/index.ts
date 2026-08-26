import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'
import { staticOAuthClients } from './lib/config.js'
import { startExpirySweep } from './lib/expiry-sweep.js'
import { logger, safeError } from './lib/logger.js'
import { maintenanceService, oauthService } from './lib/services.js'

const port = Number(process.env.PORT) || 8100

logger.info({ port }, 'Starting Hono server')

serve({
  fetch: app.fetch,
  port,
})

// Expired sessions and reset tokens are already ignored by every read; this
// is what stops the rows themselves accumulating forever.
startExpirySweep(maintenanceService)

// Clients an operator pre-registered via OAUTH_STATIC_CLIENTS. Reconciled
// here rather than at `lib/services.ts` module load, so importing a service in
// a test does not reach for the database. A malformed value has already
// stopped the process in `lib/config.ts`; a failure here is the database being
// unreachable, which is not a reason to refuse to serve everything else.
if (staticOAuthClients.length > 0) {
  void oauthService
    .reconcileStaticClients(staticOAuthClients)
    .then(() =>
      logger.info(
        { clients: staticOAuthClients.length },
        'Reconciled static OAuth clients'
      )
    )
    .catch((err: unknown) =>
      logger.error(
        { error: safeError(err) },
        'Could not reconcile static OAuth clients'
      )
    )
}

logger.info({ port }, 'Hono server is running')
