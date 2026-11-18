import { WriteConflictError } from '@pinsquirrel/domain'
import { hasDriverErrorCode } from './driver-error.js'

/**
 * Was this InnoDB rolling the transaction back to break a lock cycle
 * (ER_LOCK_DEADLOCK, errno 1213)?
 */
export function isDeadlockError(error: unknown): boolean {
  return hasDriverErrorCode(error, 'ER_LOCK_DEADLOCK')
}

/**
 * Run a whole transaction, and once more if InnoDB chose it as the victim of
 * a deadlock. The victim has been rolled back in full, so the second run
 * starts from nothing and re-reads everything it decides on.
 */
export async function retryOnDeadlock<T>(
  transaction: () => Promise<T>
): Promise<T> {
  try {
    return await transaction()
  } catch (error) {
    if (!isDeadlockError(error)) {
      throw error
    }
    try {
      return await transaction()
    } catch (again) {
      throw isDeadlockError(again)
        ? new WriteConflictError({ cause: again })
        : again
    }
  }
}
