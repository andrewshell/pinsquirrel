/**
 * MySQL rejects OFFSET unless LIMIT is present, and Drizzle emits exactly the
 * clauses it is given. An offset-without-limit query therefore pairs the offset
 * with the largest signed 32-bit integer — the conventional MySQL spelling of
 * "everything from here on".
 */
export const OFFSET_WITHOUT_LIMIT = 2147483647

/**
 * A Drizzle `$dynamic()` query: chaining limit/offset returns the same type, so
 * pagination can be applied conditionally without casting through `any`.
 */
export interface PaginatableQuery<T> {
  limit(n: number): T
  offset(n: number): T
}

/** Apply optional limit/offset to a `$dynamic()` query. */
export function applyPagination<T extends PaginatableQuery<T>>(
  query: T,
  options?: { limit?: number; offset?: number }
): T {
  if (options?.limit !== undefined && options?.offset !== undefined) {
    return query.limit(options.limit).offset(options.offset)
  }
  if (options?.limit !== undefined) {
    return query.limit(options.limit)
  }
  if (options?.offset !== undefined) {
    return query.limit(OFFSET_WITHOUT_LIMIT).offset(options.offset)
  }
  return query
}
