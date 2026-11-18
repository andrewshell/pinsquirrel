import type { OAuthService } from '@pinsquirrel/services'
import type { StaticOAuthClient } from './config'
import { logger, safeError } from './logger'

export async function reconcileStaticClients(
  service: Pick<OAuthService, 'reconcileStaticClients'>,
  clients: StaticOAuthClient[]
): Promise<void> {
  const failures = await service.reconcileStaticClients(clients)
  for (const { clientId, error } of failures) {
    logger.error(
      { clientId, error: safeError(error) },
      'Could not reconcile a static OAuth client'
    )
  }
  logger.info(
    { clients: clients.length, failed: failures.length },
    'Reconciled static OAuth clients'
  )
}
