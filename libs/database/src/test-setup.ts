import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://pinsquirrel:pinsquirrel@localhost:5432/pinsquirrel_test'

export async function setup() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })

  try {
    // Drop all tables with CASCADE to handle foreign key constraints
    await pool.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        -- Disable foreign key checks
        EXECUTE 'SET session_replication_role = replica';

        -- Drop all tables in the public schema
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;

        -- Also drop the drizzle migrations table
        DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE;
        DROP TABLE IF EXISTS drizzle."__drizzle_migrations" CASCADE;

        -- Re-enable foreign key checks
        EXECUTE 'SET session_replication_role = DEFAULT';
      END $$;
    `)

    // Run migrations
    const db = drizzle(pool)
    // The migrate function needs the path to the migrations folder
    const migrationsPath = process.cwd().endsWith('database')
      ? './src/migrations'
      : './libs/database/src/migrations'
    await migrate(db, {
      migrationsFolder: migrationsPath,
    })
  } catch (error) {
    console.error('Error in test setup:', error)
    throw error
  } finally {
    await pool.end()
  }
}

export async function teardown() {
  // Optional: Clean up after all tests
  // For now, we'll leave the test database as is
}
