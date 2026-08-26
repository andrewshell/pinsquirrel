import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import type { MySql2Database } from 'drizzle-orm/mysql2'

/**
 * Bring a database up to the current schema.
 *
 * The generated SQL lives inside this package, so the folder is resolved from
 * this file rather than from the process's working directory: the callers run
 * from different packages (this package's own test setup, and the Hono app's,
 * which needs the schema in place before its end-to-end test opens the app).
 *
 * Additive only. It applies whatever migrations have not run yet and touches
 * nothing else, which is what makes it safe to call from a test setup that
 * must not destroy data another run is using.
 */
export const migrationsFolder = fileURLToPath(
  new URL('./migrations', import.meta.url)
)

export async function applyMigrations(db: MySql2Database): Promise<void> {
  await migrate(db, { migrationsFolder })
}
