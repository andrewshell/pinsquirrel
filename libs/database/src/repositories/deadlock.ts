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
 * starts from nothing and re-reads everything it decides on. A second
 * deadlock is thrown to the caller.
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
    return transaction()
  }
}
