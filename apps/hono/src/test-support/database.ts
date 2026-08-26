import { applyMigrations, createDatabaseClient } from '@pinsquirrel/database'
import { TEST_DATABASE_URL } from './test-database-url.js'

/**
 * Vitest `globalSetup`: put the schema in place before any test opens the app.
 *
 * Additive only, unlike `libs/database`'s own setup, which drops every table
 * first. Nothing here may destroy data, because the two packages share this
 * database - `turbo.json` orders their test tasks so the destructive one never
 * runs alongside this package's end-to-end test, and this half stays safe to
 * run at any time.
 */
export async function setup(): Promise<void> {
  const db = createDatabaseClient(TEST_DATABASE_URL)

  try {
    await applyMigrations(db)
  } catch (error) {
    // Vitest swallows the stack of a setup failure, so say what to do about it
    // before rethrowing. Almost always the container is not running.
    // eslint-disable-next-line no-console
    console.error(
      `Could not prepare ${TEST_DATABASE_URL}. Start the dev database with ` +
        '`pnpm db:up` and try again.',
      error
    )
    throw error
  } finally {
    // The pool would otherwise hold the vitest process open after the run.
    await db.$client.end()
  }
}
