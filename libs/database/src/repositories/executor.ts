import type { MySql2Database } from 'drizzle-orm/mysql2'

/**
 * Either the pool-backed client or a transaction handle from
 * `db.transaction(...)`.
 *
 * A repository method that has to be able to run inside a caller's transaction
 * takes one of these instead of reaching for `this.db`. Drizzle does not export
 * its mysql2 transaction type, so it is read back off the `transaction`
 * signature: the first argument of the callback `transaction` is given.
 */
export type Executor =
  MySql2Database | Parameters<Parameters<MySql2Database['transaction']>[0]>[0]
