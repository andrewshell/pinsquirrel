import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { usersTable } from '~/db/schema/users';
import { hashPassword, verifyPassword } from '~/lib/auth';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

// Create in-memory test database
const client = createClient({ url: ':memory:' });
const testDb = drizzle(client);

// Mock the db module
vi.mock('~/lib/db', () => ({
  default: {
    db: testDb,
  },
}));

describe('Signup Database Integration', () => {
  beforeEach(async () => {
    // Create tables before each test
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        created_at integer NOT NULL,
        updated_at integer,
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        email text NOT NULL,
        password text NOT NULL
      );
    `);

    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email);
    `);
  });

  // Clean up test data after each test
  afterEach(async () => {
    try {
      await testDb.delete(usersTable);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create user in database', async () => {
    const email = 'test@example.com';
    const password = 'testpassword123';
    const hashedPassword = hashPassword(password);

    // Insert user
    await testDb.insert(usersTable).values({
      email,
      password: hashedPassword,
    });

    // Verify user was created
    const users = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(email);
    expect(users[0].password).toBe(hashedPassword);
    expect(verifyPassword(password, users[0].password)).toBe(true);
  });

  it('should enforce unique email constraint', async () => {
    const email = 'test@example.com';
    const password = 'testpassword123';
    const hashedPassword = hashPassword(password);

    // Insert first user
    await testDb.insert(usersTable).values({
      email,
      password: hashedPassword,
    });

    // Try to insert duplicate email
    await expect(
      testDb.insert(usersTable).values({
        email,
        password: hashPassword('differentpassword'),
      })
    ).rejects.toThrow();
  });

  it('should check for existing user correctly', async () => {
    const email = 'test@example.com';
    const hashedPassword = hashPassword('testpassword123');

    // First check - no user exists
    const noUsers = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    expect(noUsers).toHaveLength(0);

    // Create user
    await testDb.insert(usersTable).values({
      email,
      password: hashedPassword,
    });

    // Second check - user exists
    const existingUsers = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    expect(existingUsers).toHaveLength(1);
    expect(existingUsers[0].email).toBe(email);
  });

  it('should store and verify password correctly', async () => {
    const email = 'test@example.com';
    const originalPassword = 'mySecurePassword123!';
    const hashedPassword = hashPassword(originalPassword);

    // Store user with hashed password
    await testDb.insert(usersTable).values({
      email,
      password: hashedPassword,
    });

    // Retrieve user
    const users = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));
    const storedUser = users[0];

    // Verify password works
    expect(verifyPassword(originalPassword, storedUser.password)).toBe(true);
    expect(verifyPassword('wrongpassword', storedUser.password)).toBe(false);

    // Ensure password is not stored in plain text
    expect(storedUser.password).not.toBe(originalPassword);
    expect(storedUser.password).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);
  });

  it('should handle special characters in email and password', async () => {
    const email = 'test+special@example-domain.co.uk';
    const password = 'P@ssw0rd!@#$%^&*()_+-=[]{}|;:,.<>?';
    const hashedPassword = hashPassword(password);

    await testDb.insert(usersTable).values({
      email,
      password: hashedPassword,
    });

    const users = await testDb
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email));

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(email);
    expect(verifyPassword(password, users[0].password)).toBe(true);

    // Cleanup special test case
    await testDb.delete(usersTable).where(eq(usersTable.email, email));
  });
});
