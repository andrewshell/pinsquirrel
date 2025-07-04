import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import Signup, { signupSchema } from './signup';

// Mock the database and auth modules
vi.mock('~/lib/db', () => ({
  default: {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('~/lib/auth', () => ({
  hashPassword: vi.fn((password: string) => `hashed_${password}`),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}));

vi.mock('~/db/schema/users', () => ({
  usersTable: {
    email: 'email_column',
  },
}));

describe('Signup Form Validation Schema', () => {
  it('should validate valid signup data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'valid-code',
      terms: 'on',
    };

    const result = signupSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
      inviteCode: 'valid-code',
      terms: 'on',
    };

    const result = signupSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['email']);
  });

  it('should reject short password', () => {
    const invalidData = {
      email: 'test@example.com',
      password: '123',
      inviteCode: 'valid-code',
      terms: 'on',
    };

    const result = signupSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['password']);
    expect(result.error?.errors[0].message).toBe(
      'Password must be at least 8 characters long'
    );
  });

  it('should reject without terms agreement', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'password123',
      inviteCode: 'valid-code',
      terms: 'off',
    };

    const result = signupSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['terms']);
    expect(result.error?.errors[0].message).toBe(
      'You must agree to the terms of service'
    );
  });

  it('should reject missing invite code', () => {
    const invalidData = {
      email: 'test@example.com',
      password: 'password123',
      inviteCode: '',
      terms: 'on',
    };

    const result = signupSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    expect(result.error?.errors[0].path).toEqual(['inviteCode']);
    expect(result.error?.errors[0].message).toBe('Invite code is required');
  });
});

describe('Signup Form Component', () => {
  const renderSignupForm = (actionData?: any) => {
    const router = createMemoryRouter(
      [
        {
          path: '/signup',
          element: (
            <Signup
              actionData={actionData}
              params={{}}
              loaderData={undefined}
              matches={[
                {
                  id: 'root',
                  params: {},
                  pathname: '/',
                  data: { user: null },
                  handle: undefined,
                },
                {
                  id: 'routes/signup',
                  params: {},
                  pathname: '/signup',
                  data: undefined,
                  handle: undefined,
                },
              ]}
            />
          ),
          action: () => null,
        },
        {
          path: '/terms',
          element: <div>Terms Page</div>,
        },
        {
          path: '/privacy',
          element: <div>Privacy Page</div>,
        },
        {
          path: '/login',
          element: <div>Login Page</div>,
        },
      ],
      {
        initialEntries: ['/signup'],
      }
    );

    return render(<RouterProvider router={router} />);
  };

  it('should render all form fields', () => {
    renderSignupForm();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /start hoarding/i })
    ).toBeInTheDocument();
  });

  it('should show field validation errors', () => {
    const actionData = {
      fieldErrors: {
        email: 'Invalid email address',
        password: 'Password must be at least 8 characters long',
        inviteCode: 'Invalid invite code',
        terms: 'You must agree to the terms of service',
      },
      error: 'Please fix the errors below',
    };

    renderSignupForm(actionData);

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(
      screen.getByText('Password must be at least 8 characters long')
    ).toBeInTheDocument();
    expect(screen.getByText('Invalid invite code')).toBeInTheDocument();
    expect(
      screen.getByText('You must agree to the terms of service')
    ).toBeInTheDocument();
    expect(screen.getByText('Please fix the errors below')).toBeInTheDocument();
  });

  it('should apply error styling to invalid fields', () => {
    const actionData = {
      fieldErrors: {
        email: 'Invalid email address',
        password: 'Password too short',
      },
    };

    renderSignupForm(actionData);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toHaveClass('border-red-300');
    expect(passwordInput).toHaveClass('border-red-300');
  });

  it('should have working form submission', async () => {
    const user = userEvent.setup();
    renderSignupForm();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const inviteCodeInput = screen.getByLabelText(/invite code/i);
    const termsCheckbox = screen.getByRole('checkbox');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(inviteCodeInput, 'test-code');
    await user.click(termsCheckbox);

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
    expect(inviteCodeInput).toHaveValue('test-code');
    expect(termsCheckbox).toBeChecked();
  });

  it('should show helper text when no password error', () => {
    renderSignupForm();

    expect(
      screen.getByText('Must be at least 8 characters long')
    ).toBeInTheDocument();
  });

  it('should have links to terms and privacy', () => {
    renderSignupForm();

    expect(
      screen.getByRole('link', { name: /terms of service/i })
    ).toHaveAttribute('href', '/terms');
    expect(
      screen.getByRole('link', { name: /privacy policy/i })
    ).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login'
    );
  });
});
