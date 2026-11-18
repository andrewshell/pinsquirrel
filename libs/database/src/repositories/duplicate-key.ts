import { hasDriverErrorCode } from './driver-error.js'

/** Was this MySQL's duplicate-key error (ER_DUP_ENTRY, errno 1062)? */
export function isDuplicateKeyError(error: unknown): boolean {
  return hasDriverErrorCode(error, 'ER_DUP_ENTRY')
}
