/**
 * Was this MySQL's duplicate-key error (ER_DUP_ENTRY, errno 1062)?
 *
 * Drizzle wraps driver errors in a `DrizzleQueryError`, so the mysql2 error
 * carrying the code sits on `cause` — possibly more than one level down. The
 * walk is bounded so a self-referential `cause` cannot spin.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  let current: unknown = error

  for (let depth = 0; current != null && depth < 5; depth++) {
    if (typeof current === 'object' && 'code' in current) {
      if ((current as { code?: unknown }).code === 'ER_DUP_ENTRY') {
        return true
      }
    }
    current = (current as { cause?: unknown }).cause
  }

  return false
}
