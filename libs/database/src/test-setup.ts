import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { applyMigrations } from './migrate.js'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'mysql://pinsquirrel:pinsquirrel@localhost:3306/pinsquirrel_test'

export async function setup() {
  const pool = mysql.createPool(TEST_DATABASE_URL)

  try {
    // Drop all tables with foreign key checks disabled
    await pool.query('SET FOREIGN_KEY_CHECKS = 0')

    const [rows] = await pool.query('SHOW TABLES')
    for (const row of rows as { [key: string]: string }[]) {
      const tableName = Object.values(row)[0]
      await pool.query(`DROP TABLE IF EXISTS \`${tableName}\``)
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1')

    // Run migrations. The folder is resolved inside `applyMigrations`, from
    // the package rather than from the working directory.
    await applyMigrations(drizzle({ client: pool }))
  } catch (error) {
    // Vitest swallows the stack of a setup failure, so log it before rethrowing.
    // eslint-disable-next-line no-console
    console.error('Error in test setup:', error)
    throw error
  } finally {
    await pool.end()
  }
}

export async function teardown() {
  // Optional: Clean up after all tests
}
