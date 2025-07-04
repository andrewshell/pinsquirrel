import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { usersTable } from '~/db/schema/users';
import { hashPassword, verifyPassword } from '~/lib/auth';
import {
  createSessionToken,
  verifySessionToken,
  getSessionFromRequest,
} from '~/lib/session';
import { requireAuth, getOptionalAuth } from '~/lib/auth-utils';
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

describe('Authentication Integration', () => {
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

  afterEach(async () => {
    try {
      await testDb.delete(usersTable);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('End-to-End Authentication Flow', () => {
    it('should complete full signup and login flow', async () => {
      const email = 'test@example.com';
      const password = 'testpassword123';

      // 1. Create user (simulate signup)
      const hashedPassword = hashPassword(password);
      await testDb.insert(usersTable).values({
        email,
        password: hashedPassword,
      });

      // 2. Verify user was created
      const users = await testDb
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      expect(users).toHaveLength(1);
      const user = users[0];

      // 3. Verify password (simulate login)
      const isValidPassword = verifyPassword(password, user.password);
      expect(isValidPassword).toBe(true);

      // 4. Create session token
      const token = createSessionToken(user.id, user.email);
      expect(token).toBeTruthy();

      // 5. Verify session token
      const session = verifySessionToken(token);
      expect(session).toBeTruthy();
      expect(session?.id).toBe(user.id);
      expect(session?.email).toBe(email);
    });

    it('should handle invalid login attempts', async () => {
      const email = 'test@example.com';
      const correctPassword = 'correctpassword';
      const wrongPassword = 'wrongpassword';

      // Create user
      const hashedPassword = hashPassword(correctPassword);
      await testDb.insert(usersTable).values({
        email,
        password: hashedPassword,
      });

      // Get user
      const users = await testDb
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      const user = users[0];

      // Test wrong password
      expect(verifyPassword(wrongPassword, user.password)).toBe(false);

      // Test correct password
      expect(verifyPassword(correctPassword, user.password)).toBe(true);
    });

    it('should handle session authentication in requests', async () => {
      const email = 'test@example.com';
      const password = 'testpassword123';

      // Create user
      const hashedPassword = hashPassword(password);
      await testDb.insert(usersTable).values({
        email,
        password: hashedPassword,
      });

      const users = await testDb
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email));
      const user = users[0];

      // Create session
      const token = createSessionToken(user.id, user.email);

      // Test authenticated request
      const authenticatedRequest = new Request('http://localhost', {
        headers: {
          Cookie: `session=${token}`,
        },
      });

      const session = getSessionFromRequest(authenticatedRequest);
      expect(session).toBeTruthy();
      expect(session?.id).toBe(user.id);

      // Test with auth utils
      const authResult = requireAuth(authenticatedRequest);
      expect(authResult.id).toBe(user.id);
      expect(authResult.email).toBe(email);

      // Test unauthenticated request
      const unauthenticatedRequest = new Request('http://localhost');

      expect(getOptionalAuth(unauthenticatedRequest)).toBeNull();
      expect(() => requireAuth(unauthenticatedRequest)).toThrow();
    });

    it('should handle expired sessions', () => {
      // Mock time to create an expired token
      const originalDateNow = Date.now;
      const pastTime = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago

      Date.now = vi.fn(() => pastTime);

      try {
        const token = createSessionToken(123, 'test@example.com');

        // Restore current time
        Date.now = originalDateNow;

        // Token should now be expired
        expect(verifySessionToken(token)).toBeNull();

        // Request with expired token should fail auth
        const request = new Request('http://localhost', {
          headers: {
            Cookie: `session=${token}`,
          },
        });

        expect(getOptionalAuth(request)).toBeNull();
        expect(() => requireAuth(request)).toThrow();
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should handle session token tampering', async () => {
      const email = 'test@example.com';

      // Create valid token
      const validToken = createSessionToken(123, email);

      // Tamper with token
      const [payload] = validToken.split('.');
      const tamperedToken = `${payload}.tampered-signature`;

      // Tampered token should not verify
      expect(verifySessionToken(tamperedToken)).toBeNull();

      // Request with tampered token should fail auth
      const request = new Request('http://localhost', {
        headers: {
          Cookie: `session=${tamperedToken}`,
        },
      });

      expect(getOptionalAuth(request)).toBeNull();
      expect(() => requireAuth(request)).toThrow();
    });

    it('should handle multiple users with different sessions', async () => {
      // Create two users
      const user1Email = 'user1@example.com';
      const user2Email = 'user2@example.com';
      const password = 'testpassword123';
      const hashedPassword = hashPassword(password);

      await testDb.insert(usersTable).values([
        { email: user1Email, password: hashedPassword },
        { email: user2Email, password: hashedPassword },
      ]);

      const users = await testDb.select().from(usersTable);
      const user1 = users.find((u) => u.email === user1Email);
      const user2 = users.find((u) => u.email === user2Email);

      // Create separate sessions
      const token1 = createSessionToken(user1!.id, user1!.email);
      const token2 = createSessionToken(user2!.id, user2!.email);

      // Verify each session is independent
      const session1 = verifySessionToken(token1);
      const session2 = verifySessionToken(token2);

      expect(session1?.id).toBe(user1!.id);
      expect(session1?.email).toBe(user1Email);
      expect(session2?.id).toBe(user2!.id);
      expect(session2?.email).toBe(user2Email);

      expect(session1?.id).not.toBe(session2?.id);
    });
  });

  describe('Security Features', () => {
    it('should use secure password hashing', () => {
      const password = 'testpassword123';

      // Generate multiple hashes of the same password
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      // Hashes should be different (due to unique salts)
      expect(hash1).not.toBe(hash2);

      // Both should verify correctly
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);

      // Wrong password should not verify
      expect(verifyPassword('wrongpassword', hash1)).toBe(false);
    });

    it('should create unique session tokens', () => {
      const userId = 123;
      const email = 'test@example.com';

      // Create tokens with actual time differences
      const token1 = createSessionToken(userId, email);

      // Force a time difference by creating token at different millisecond
      const now = Date.now();
      while (Date.now() === now) {
        // busy wait to ensure different timestamp
      }
      const token2 = createSessionToken(userId, email);

      expect(token1).not.toBe(token2);

      // Both tokens should verify to the same user
      const session1 = verifySessionToken(token1);
      const session2 = verifySessionToken(token2);

      expect(session1?.id).toBe(userId);
      expect(session2?.id).toBe(userId);
    });

    it('should validate session token structure', () => {
      const validToken = createSessionToken(123, 'test@example.com');

      // Valid token should have proper structure
      expect(validToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

      const [payload, signature] = validToken.split('.');
      expect(payload).toBeTruthy();
      expect(signature).toBeTruthy();

      // Invalid structures should not verify
      expect(verifySessionToken('invalid')).toBeNull();
      expect(verifySessionToken('invalid.token.structure')).toBeNull();
      expect(verifySessionToken('onlyonepart')).toBeNull();
    });
  });
});
