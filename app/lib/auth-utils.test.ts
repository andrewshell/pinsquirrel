import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requireAuth,
  getOptionalAuth,
  redirectIfAuthenticated,
  createAuthLoader,
  createAuthAction,
} from './auth-utils';

// Mock the session module
vi.mock('~/lib/session', () => ({
  getSessionFromRequest: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    redirect: vi.fn((url: string) => {
      throw new Error(`Redirect to ${url}`);
    }),
  };
});

describe('Authentication Utils', () => {
  let mockGetSessionFromRequest: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const sessionModule = await import('~/lib/session');
    mockGetSessionFromRequest = sessionModule.getSessionFromRequest;
  });

  describe('requireAuth', () => {
    it('should return session data when user is authenticated', () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const request = new Request('http://localhost');
      const result = requireAuth(request);

      expect(result).toEqual(mockSession);
      expect(mockGetSessionFromRequest).toHaveBeenCalledWith(request);
    });

    it('should redirect to login when user is not authenticated', () => {
      mockGetSessionFromRequest.mockReturnValue(null);

      const request = new Request('http://localhost');

      expect(() => requireAuth(request)).toThrow(
        'Redirect to /login?message=Please sign in to continue'
      );
    });
  });

  describe('getOptionalAuth', () => {
    it('should return session data when user is authenticated', () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const request = new Request('http://localhost');
      const result = getOptionalAuth(request);

      expect(result).toEqual(mockSession);
    });

    it('should return null when user is not authenticated', () => {
      mockGetSessionFromRequest.mockReturnValue(null);

      const request = new Request('http://localhost');
      const result = getOptionalAuth(request);

      expect(result).toBeNull();
    });
  });

  describe('redirectIfAuthenticated', () => {
    it('should redirect to default path when user is authenticated', () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const request = new Request('http://localhost');

      expect(() => redirectIfAuthenticated(request)).toThrow(
        'Redirect to /links'
      );
    });

    it('should redirect to custom path when user is authenticated', () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const request = new Request('http://localhost');

      expect(() => redirectIfAuthenticated(request, '/dashboard')).toThrow(
        'Redirect to /dashboard'
      );
    });

    it('should not redirect when user is not authenticated', () => {
      mockGetSessionFromRequest.mockReturnValue(null);

      const request = new Request('http://localhost');

      expect(() => redirectIfAuthenticated(request)).not.toThrow();
    });
  });

  describe('createAuthLoader', () => {
    it('should create loader that requires authentication', async () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const loader = createAuthLoader();
      const request = new Request('http://localhost');
      const params = {};

      const result = await loader({ request, params });

      expect(result).toEqual({
        id: 123,
        email: 'test@example.com',
      });
    });

    it('should redirect when user is not authenticated', async () => {
      mockGetSessionFromRequest.mockReturnValue(null);

      const loader = createAuthLoader();
      const request = new Request('http://localhost');
      const params = {};

      await expect(loader({ request, params })).rejects.toThrow(
        'Redirect to /login?message=Please sign in to continue'
      );
    });

    it('should call custom loader function with user data', async () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const customLoader = vi.fn().mockResolvedValue({ data: 'custom' });
      const loader = createAuthLoader(customLoader);

      const request = new Request('http://localhost');
      const params = { id: '456' };

      const result = await loader({ request, params });

      expect(customLoader).toHaveBeenCalledWith({
        request,
        params,
        user: { id: 123, email: 'test@example.com' },
      });
      expect(result).toEqual({ data: 'custom' });
    });
  });

  describe('createAuthAction', () => {
    it('should create action that requires authentication', async () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const action = createAuthAction(actionFn);

      const request = new Request('http://localhost');
      const params = { id: '456' };

      const result = await action({ request, params });

      expect(actionFn).toHaveBeenCalledWith({
        request,
        params,
        user: { id: 123, email: 'test@example.com' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should redirect when user is not authenticated', async () => {
      mockGetSessionFromRequest.mockReturnValue(null);

      const actionFn = vi.fn();
      const action = createAuthAction(actionFn);

      const request = new Request('http://localhost');
      const params = {};

      await expect(action({ request, params })).rejects.toThrow(
        'Redirect to /login?message=Please sign in to continue'
      );
      expect(actionFn).not.toHaveBeenCalled();
    });

    it('should handle async action functions', async () => {
      const mockSession = {
        id: 123,
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 86400000,
      };

      mockGetSessionFromRequest.mockReturnValue(mockSession);

      const actionFn = vi.fn().mockImplementation(async ({ user }) => {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { userId: user.id };
      });

      const action = createAuthAction(actionFn);

      const request = new Request('http://localhost');
      const params = {};

      const result = await action({ request, params });

      expect(result).toEqual({ userId: 123 });
    });
  });
});
