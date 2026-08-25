import type { SweepResult } from '@pinsquirrel/services'
import { logger, safeError } from './logger'

/**
 * How often expired rows are swept.
 *
 * Nothing depends on the exact figure: every read already honours `expires_at`,
 * so the sweep is about the size of the tables, not about correctness.
 */
export const SWEEP_INTERVAL_MS = 60 * 60 * 1000

/** Just enough of `MaintenanceService` to schedule, so tests can pass a fake. */
interface Sweeper {
  sweepExpired(): Promise<SweepResult>
}

/**
 * Start the background sweep of expired sessions and reset tokens.
 *
 * Deliberately the simplest thing that works — one unref'd interval in the
 * server process, no scheduler, no lock. Two app instances sweeping at once
 * would each delete rows the other already deleted, which is harmless. Phase
 * 6d's `oauth_clients` cleanup belongs in `MaintenanceService.sweepExpired`
 * rather than in a second job here.
 */
export function startExpirySweep(
  service: Sweeper,
  intervalMs: number = SWEEP_INTERVAL_MS
): NodeJS.Timeout {
  const sweep = async () => {
    try {
      const removed = await service.sweepExpired()
      logger.info(removed, 'Swept expired rows')
    } catch (err) {
      // Housekeeping: a database blip here must not take down a server that is
      // otherwise serving requests, and must not stop the schedule.
      logger.error({ error: safeError(err) }, 'Expiry sweep failed')
    }
  }

  // At boot as well as on the interval, so a process that restarts more often
  // than the interval still sweeps.
  void sweep()

  const timer = setInterval(() => void sweep(), intervalMs)
  // Never a reason to keep the process alive.
  timer.unref()

  return timer
}
