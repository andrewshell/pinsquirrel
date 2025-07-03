import { beforeAll, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

let testDb: ReturnType<typeof drizzle>;

beforeAll(async () => {
  // Create in-memory database for tests
  const client = createClient({
    url: ':memory:',
  });

  testDb = drizzle(client);

  // Create tables
  await client.execute(`
    CREATE TABLE users (
      created_at integer NOT NULL,
      updated_at integer,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      email text NOT NULL,
      password text NOT NULL
    );
  `);

  await client.execute(`
    CREATE UNIQUE INDEX users_email_unique ON users (email);
  `);

  // Mock the db module to use test database
  const mockDb = {
    db: testDb,
  };

  // This will be available to tests
  (global as Record<string, unknown>).testDb = mockDb;
});

afterAll(async () => {
  if (testDb?.$client) {
    testDb.$client.close();
  }
});
