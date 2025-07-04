import { describe, it, expect, vi, beforeEach } from 'vitest';
import { action } from './signup';

// Mock modules
vi.mock('~/lib/db', () => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn(),
    delete: vi.fn().mockReturnThis(),
  };

  return {
    default: {
      db: mockQueryBuilder,
    },
  };
});

vi.mock('~/lib/auth', () => ({
  hashPassword: vi.fn((password: string) => `hashed_${password}`),
  hashEmail: vi.fn((email: string) => `hashed_${email}`),
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
    redirect: vi.fn((url: string) => ({ type: 'redirect', url })),
  };
});

vi.mock('~/lib/config', () => ({
  default: {
    auth: {
      inviteCode: 'TEST_CODE',
    },
  },
}));

describe('Signup Action', () => {
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
    // Get the mocked db and reset implementations
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockResolvedValue([]);
    mockDb.values.mockResolvedValue(undefined);
  });

  it('should return validation errors for invalid data', async () => {
    const request = createMockRequest({
      email: 'invalid-email',
      password: '123',
      inviteCode: '', // empty invite code
      terms: 'off',
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect(result).toHaveProperty('error', 'Please fix the errors below');
    expect((result as any).fieldErrors.email).toBeTruthy();
    expect((result as any).fieldErrors.password).toBe(
      'Password must be at least 8 characters long'
    );
    expect((result as any).fieldErrors.inviteCode).toBe(
      'Invite code is required'
    );
    expect((result as any).fieldErrors.terms).toBe(
      'You must agree to the terms of service'
    );
  });

  it('should return error for existing user', async () => {
    // Mock existing user found
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockResolvedValue([{ id: 1, email: 'test@example.com' }]);

    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'TEST_CODE',
      terms: 'on',
    });

    const result = await action({ request } as any);

    expect(result).toEqual({
      error: 'An account with this email already exists',
    });
  });

  it('should create new user successfully', async () => {
    const { redirect } = await import('react-router');
    const { hashPassword } = await import('~/lib/auth');
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;

    // Mock no existing user found
    mockDb.limit.mockResolvedValue([]);
    mockDb.values.mockResolvedValue(undefined);

    const request = createMockRequest({
      email: 'newuser@example.com',
      password: 'password123',
      inviteCode: 'TEST_CODE',
      terms: 'on',
    });

    await action({ request } as any);

    expect(hashPassword).toHaveBeenCalledWith('password123');
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith({
      email: 'hashed_newuser@example.com',
      password: 'hashed_password123',
    });
    expect(redirect).toHaveBeenCalledWith(
      '/login?message=Account created successfully'
    );
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockRejectedValue(new Error('Database error'));

    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'TEST_CODE',
      terms: 'on',
    });

    const result = await action({ request } as any);

    expect(result).toEqual({
      error: 'An error occurred creating your account. Please try again.',
    });
  });

  it('should validate email with standard format', async () => {
    const request = createMockRequest({
      email: 'test@',
      password: 'password123',
      inviteCode: 'TEST_CODE',
      terms: 'on',
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect((result as any).fieldErrors.email).toBeTruthy();
  });

  it('should require minimum password length', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      password: '1234567', // 7 characters
      inviteCode: 'TEST_CODE',
      terms: 'on',
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect((result as any).fieldErrors.password).toBe(
      'Password must be at least 8 characters long'
    );
  });

  it('should require terms acceptance', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'Hoopla!',
      // missing terms
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect((result as any).fieldErrors.terms).toBe(
      'You must agree to the terms of service'
    );
  });

  it('should reject invalid invite code', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'WrongCode',
      terms: 'on',
    });

    const result = await action({ request } as any);

    expect(result).toEqual({
      fieldErrors: { inviteCode: 'Invalid invite code' },
      error: 'Please check your invite code and try again',
    });
  });

  it('should accept correct invite code', async () => {
    const { redirect } = await import('react-router');
    const db = await import('~/lib/db');
    const mockDb = db.default.db as any;
    mockDb.limit.mockResolvedValue([]); // No existing user

    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'TEST_CODE', // Correct invite code
      terms: 'on',
    });

    await action({ request } as any);

    expect(redirect).toHaveBeenCalledWith(
      '/login?message=Account created successfully'
    );
  });

  it('should handle missing invite code', async () => {
    const request = createMockRequest({
      email: 'test@example.com',
      password: 'password123',
      // missing inviteCode
      terms: 'on',
    });

    const result = await action({ request } as any);

    expect(result).toHaveProperty('fieldErrors');
    expect((result as any).fieldErrors.inviteCode).toBe(
      'Invite code is required'
    );
  });
});
