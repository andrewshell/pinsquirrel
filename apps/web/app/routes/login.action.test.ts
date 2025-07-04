import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginSchema, action } from './login';

// Mock modules
vi.mock('~/lib/db', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
  };

  return {
    default: {
      db: mockQueryBuilder,
    },
  };
});

vi.mock('~/lib/auth', () => ({
  verifyPassword: vi.fn(),
  hashEmail: vi.fn((_email: string) => `hashed_email`),
}));

vi.mock('~/lib/session', () => ({
  createSessionCookie: vi.fn(
    (userId: number, _email: string) => `session=mock-token-${userId}; HttpOnly`
  ),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('~/db/schema/users', () => ({
  usersTable: {
    email: 'email_column',
  },
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    redirect: vi.fn((url: string, options?: any) => ({
      type: 'redirect',
      url,
      options,
    })),
  };
});

describe('Login Form Validation Schema', () => {
  it('should validate valid login data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
    };

    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
    };

    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['email']);
  });

  it('should reject empty password', () => {
    const invalidData = {
      email: 'test@example.com',
      password: '',
    };

    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['password']);
    expect(result.error?.errors[0].message).toBe('Password is required');
  });
});

describe('Login Action', () => {
  const createMockRequest = (formData: Record<string, string>) => {
    const form = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      form.append(key, value);
    });

    return {
      formData: () => Promise.resolve(form),
    } as Request;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup default mocks
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockResolvedValue([]);
  });

  it('should return validation errors for invalid data', async () => {
    const request = createMockRequest({
      email: 'invalid-email',
      password: '',
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect(result).toHaveProperty('error', 'Please fix the errors below');
    expect((result as any).fieldErrors.email).toBeTruthy();
    expect((result as any).fieldErrors.password).toBe('Password is required');
  });

  it('should return error for non-existent user', async () => {
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockResolvedValue([]); // No user found

    const request = createMockRequest({
      email: 'nonexistent@example.com',
      password: 'password123',
    });

    const result = await action({ request } as any);

    expect(result).toEqual({
      error: 'Invalid email or password',
    });
  });

  it('should return error for invalid password', async () => {
    const db = await import('~/lib/db');
    const { verifyPassword } = await import('~/lib/auth');
    const mockDb = db.default.db as any;

    mockDb.limit.mockResolvedValue([
      {
        id: 1,
        email: 'test@example.com',
        password: 'hashed-password',
      },
    ]);

    (verifyPassword as any).mockReturnValue(false);

    const request = createMockRequest({
      email: 'test@example.com',
      password: 'wrongpassword',
    });

    const result = await action({ request } as any);

    expect(result).toEqual({
      error: 'Invalid email or password',
    });
  });

  it('should successfully login with valid credentials', async () => {
    const db = await import('~/lib/db');
    const { verifyPassword } = await import('~/lib/auth');
    const { createSessionCookie } = await import('~/lib/session');
    const { redirect } = await import('react-router');
    const mockDb = db.default.db as any;

    const mockUser = {
      id: 1,
      email: 'test@example.com',
      password: 'hashed-password',
    };

    mockDb.limit.mockResolvedValue([mockUser]);
    (verifyPassword as any).mockReturnValue(true);
    (createSessionCookie as any).mockReturnValue('session=token; HttpOnly');

    const request = createMockRequest({
      email: 'test@example.com',
      password: 'correctpassword',
    });

    await action({ request } as any);

    expect(verifyPassword).toHaveBeenCalledWith(
      'correctpassword',
      'hashed-password'
    );
    expect(createSessionCookie).toHaveBeenCalledWith(1, 'test@example.com');
    expect(redirect).toHaveBeenCalledWith('/links', {
      headers: {
        'Set-Cookie': 'session=token; HttpOnly',
      },
    });
  });

  it('should handle database errors gracefully', async () => {
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await action({ request } as any);

    expect(result).toEqual({
      error: 'An error occurred during login. Please try again.',
    });
  });

  it('should validate email format', async () => {
    const request = createMockRequest({
      email: 'invalid@',
      password: 'password123',
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect((result as any).fieldErrors.email).toBeTruthy();
  });
});
