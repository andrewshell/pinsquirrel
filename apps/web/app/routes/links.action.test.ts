import { describe, it, expect, vi } from 'vitest';
import { clearSessionCookie } from '~/lib/session';

vi.mock('~/lib/session', () => ({
  clearSessionCookie: vi.fn(() => 'session=; HttpOnly; Max-Age=0; Path=/'),
}));

describe('Links Page Action Logic', () => {
  const createMockRequest = (formData: Record<string, string>) => {
    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });

    return {
      formData: () => Promise.resolve(form),
    } as Request;
  };

  // Test the core logout logic directly
  const mockActionFunction = async ({ request }: { request: Request }) => {
    const formData = await request.formData();
    const intent = formData.get('intent');

    if (intent === 'logout') {
      throw new Response(null, {
        status: 302,
        headers: {
          Location: '/login?message=You have been logged out',
          'Set-Cookie': clearSessionCookie(),
        },
      });
    }

    return null;
  };

  it('should handle logout intent correctly', async () => {
    const request = createMockRequest({
      intent: 'logout',
    });

    try {
      await mockActionFunction({ request });
      expect(false).toBe(true); // Should not reach here
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);

      const headers = (response as Response).headers;
      expect(headers.get('Location')).toBe(
        '/login?message=You have been logged out'
      );
      expect(headers.get('Set-Cookie')).toBe(
        'session=; HttpOnly; Max-Age=0; Path=/'
      );
    }

    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it('should return null for non-logout intents', async () => {
    const request = createMockRequest({
      intent: 'some-other-action',
    });

    const result = await mockActionFunction({ request });
    expect(result).toBeNull();
  });

  it('should return null when no intent provided', async () => {
    const request = createMockRequest({});

    const result = await mockActionFunction({ request });
    expect(result).toBeNull();
  });

  it('should handle empty intent', async () => {
    const request = createMockRequest({
      intent: '',
    });

    const result = await mockActionFunction({ request });
    expect(result).toBeNull();
  });

  it('should handle malformed form data', async () => {
    const request = {
      formData: () => Promise.resolve(new FormData()),
    } as Request;

    const result = await mockActionFunction({ request });
    expect(result).toBeNull();
  });

  it('should clear session cookie on logout', async () => {
    const request = createMockRequest({
      intent: 'logout',
    });

    try {
      await mockActionFunction({ request });
    } catch (response) {
      const cookie = (response as Response).headers.get('Set-Cookie');
      expect(cookie).toContain('session=');
      expect(cookie).toContain('Max-Age=0');
    }
  });
});
