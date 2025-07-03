import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createSessionToken,
  verifySessionToken,
  createSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
} from './session';

describe('Session Management', () => {
  const originalEnv = process.env.SESSION_SECRET;

  beforeEach(() => {
    // Set a consistent secret for testing
    process.env.SESSION_SECRET = 'test-secret-key';
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env.SESSION_SECRET = originalEnv;
    vi.useRealTimers();
  });

  describe('Token Creation and Verification', () => {
    it('should create and verify a valid session token', () => {
      const userId = 123;
      const email = 'test@example.com';

      const token = createSessionToken(userId, email);
      const session = verifySessionToken(token);

      expect(session).toBeTruthy();
      expect(session?.id).toBe(userId);
      expect(session?.email).toBe(email);
      expect(session?.iat).toBeTruthy();
      expect(session?.exp).toBeTruthy();
    });

    it('should reject invalid token format', () => {
      expect(verifySessionToken('invalid-token')).toBeNull();
      expect(verifySessionToken('invalid.token.format')).toBeNull();
      expect(verifySessionToken('')).toBeNull();
    });

    it('should reject token with invalid signature', () => {
      const token = createSessionToken(123, 'test@example.com');
      const [payload] = token.split('.');
      const tamperedToken = `${payload}.invalid-signature`;

      expect(verifySessionToken(tamperedToken)).toBeNull();
    });

    it('should reject expired token', () => {
      const userId = 123;
      const email = 'test@example.com';

      // Create token
      const token = createSessionToken(userId, email);

      // Fast forward time by 8 days (past the 7 day expiration)
      vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000);

      expect(verifySessionToken(token)).toBeNull();
    });

    it('should accept non-expired token', () => {
      const userId = 123;
      const email = 'test@example.com';

      // Create token
      const token = createSessionToken(userId, email);

      // Fast forward time by 6 days (within the 7 day expiration)
      vi.advanceTimersByTime(6 * 24 * 60 * 60 * 1000);

      const session = verifySessionToken(token);
      expect(session).toBeTruthy();
      expect(session?.id).toBe(userId);
    });

    it('should handle malformed JSON in payload', () => {
      // Create a token with malformed JSON
      const invalidPayload = Buffer.from('invalid-json').toString('base64url');
      const token = `${invalidPayload}.signature`;

      expect(verifySessionToken(token)).toBeNull();
    });
  });

  describe('Cookie Management', () => {
    it('should create session cookie with proper format', () => {
      const userId = 123;
      const email = 'test@example.com';

      const cookie = createSessionCookie(userId, email);

      expect(cookie).toMatch(
        /^session=.+; HttpOnly; Secure; SameSite=Lax; Max-Age=\d+; Path=\/$/
      );
    });

    it('should create clear session cookie', () => {
      const cookie = clearSessionCookie();

      expect(cookie).toBe(
        'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/'
      );
    });

    it('should extract session from request cookie', () => {
      const userId = 123;
      const email = 'test@example.com';
      const token = createSessionToken(userId, email);

      const request = new Request('http://localhost', {
        headers: {
          Cookie: `session=${token}`,
        },
      });

      const session = getSessionFromRequest(request);

      expect(session).toBeTruthy();
      expect(session?.id).toBe(userId);
      expect(session?.email).toBe(email);
    });

    it('should handle multiple cookies', () => {
      const userId = 123;
      const email = 'test@example.com';
      const token = createSessionToken(userId, email);

      const request = new Request('http://localhost', {
        headers: {
          Cookie: `other=value; session=${token}; another=value`,
        },
      });

      const session = getSessionFromRequest(request);

      expect(session).toBeTruthy();
      expect(session?.id).toBe(userId);
    });

    it('should return null when no cookie header', () => {
      const request = new Request('http://localhost');

      expect(getSessionFromRequest(request)).toBeNull();
    });

    it('should return null when no session cookie', () => {
      const request = new Request('http://localhost', {
        headers: {
          Cookie: 'other=value; another=value',
        },
      });

      expect(getSessionFromRequest(request)).toBeNull();
    });

    it('should return null when session cookie has invalid token', () => {
      const request = new Request('http://localhost', {
        headers: {
          Cookie: 'session=invalid-token',
        },
      });

      expect(getSessionFromRequest(request)).toBeNull();
    });
  });

  describe('Security', () => {
    it('should create different tokens for same user data', () => {
      // Use real timers for this test to ensure different timestamps
      vi.useRealTimers();

      const userId = 123;
      const email = 'test@example.com';

      const token1 = createSessionToken(userId, email);
      // Small delay to ensure different timestamp
      const now = Date.now();
      while (Date.now() === now) {
        // busy wait for 1ms
      }
      const token2 = createSessionToken(userId, email);

      expect(token1).not.toBe(token2);

      // Restore fake timers
      vi.useFakeTimers();
    });

    it('should use different secrets to create different signatures', async () => {
      const userId = 123;
      const email = 'test@example.com';

      // Store current secret for restoration
      const originalSecret = process.env.SESSION_SECRET;

      try {
        // Create token with first secret
        process.env.SESSION_SECRET = 'secret1';

        // Clear module cache to force reload with new secret
        vi.resetModules();
        const session1 = await import('./session');

        vi.advanceTimersByTime(1);
        const token1 = session1.createSessionToken(userId, email);

        // Verify token1 works with secret1
        expect(session1.verifySessionToken(token1)).toBeTruthy();

        // Change secret and reload module
        process.env.SESSION_SECRET = 'secret2';
        vi.resetModules();
        const session2 = await import('./session');

        vi.advanceTimersByTime(1);
        const token2 = session2.createSessionToken(userId, email);

        // Tokens should be different due to different secrets
        expect(token1).not.toBe(token2);

        // First token should not verify with second secret
        expect(session2.verifySessionToken(token1)).toBeNull();

        // But second token should verify with second secret
        expect(session2.verifySessionToken(token2)).toBeTruthy();
      } finally {
        // Restore original secret
        process.env.SESSION_SECRET = originalSecret;
        vi.resetModules();
      }
    });

    it('should handle edge case user data', () => {
      const testCases = [
        { userId: 0, email: '' },
        {
          userId: Number.MAX_SAFE_INTEGER,
          email: 'very.long.email.address@very.long.domain.name.example.com',
        },
        { userId: 1, email: 'special+chars@example-domain.co.uk' },
      ];

      testCases.forEach(({ userId, email }) => {
        const token = createSessionToken(userId, email);
        const session = verifySessionToken(token);

        expect(session).toBeTruthy();
        expect(session?.id).toBe(userId);
        expect(session?.email).toBe(email);
      });
    });
  });
});
