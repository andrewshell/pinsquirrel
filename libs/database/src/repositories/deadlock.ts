import { WriteConflictError } from '@pinsquirrel/domain'
import { hasDriverErrorCode } from './driver-error.js'

/**
 * Was this InnoDB rolling the transaction back to break a lock cycle
 * (ER_LOCK_DEADLOCK, errno 1213)?
 */
export function isDeadlockError(error: unknown): boolean {
  return hasDriverErrorCode(error, 'ER_LOCK_DEADLOCK')
}

export function isLockWaitTimeoutError(error: unknown): boolean {
  return hasDriverErrorCode(error, 'ER_LOCK_WAIT_TIMEOUT')
}

/**
 * Run a write, a whole transaction or one statement, and once more if
 * InnoDB chose it as the victim of a deadlock. The victim has been rolled
 * back in full, so the second run starts from nothing and re-reads
 * everything it decides on.
 *
 * A second deadlock is a `WriteConflictError`. So is a lock wait that timed
 * out, at once: the write has already waited `innodb_lock_wait_timeout`
 * behind a lock that is probably still held, and a second run would double
 * the wait of a caller that is told to try again anyway. InnoDB undoes only
 * the statement that timed out; Drizzle rolls back the rest of the
 * transaction when the error leaves its callback.
 */
export async function writeOrConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    if (!isDeadlockError(error)) {
      throw asWriteConflict(error)
    }
    try {
      return await write()
    } catch (again) {
      throw asWriteConflict(again)
    }
  }
}

function asWriteConflict(error: unknown): unknown {
  if (isDeadlockError(error)) {
    return new WriteConflictError(
      'The write lost two deadlocks and changed nothing',
      { cause: error }
    )
  }
  if (isLockWaitTimeoutError(error)) {
    return new WriteConflictError(
      'The write waited too long for a lock and changed nothing',
      { cause: error }
    )
  }
  return error
}
