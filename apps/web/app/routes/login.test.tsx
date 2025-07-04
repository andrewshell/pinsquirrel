import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import Login from './login';

describe('Login Form Component', () => {
  const renderLoginForm = (actionData?: any) => {
    const router = createMemoryRouter(
      [
        {
          path: '/login',
          element: (
            <Login
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
                  id: 'routes/login',
                  params: {},
                  pathname: '/login',
                  data: undefined,
                  handle: undefined,
                },
              ]}
            />
          ),
          action: () => null,
        },
        {
          path: '/signup',
          element: <div>Signup Page</div>,
        },
      ],
      {
        initialEntries: ['/login'],
      }
    );

    return render(<RouterProvider router={router} />);
  };

  it('should render all form fields', () => {
    renderLoginForm();

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: /remember me/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('should show field validation errors', () => {
    const actionData = {
      fieldErrors: {
        email: 'Invalid email address',
        password: 'Password is required',
      },
      error: 'Please fix the errors below',
    };

    renderLoginForm(actionData);

    expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByText('Please fix the errors below')).toBeInTheDocument();
  });

  it('should apply error styling to invalid fields', () => {
    const actionData = {
      fieldErrors: {
        email: 'Invalid email address',
        password: 'Password is required',
      },
    };

    renderLoginForm(actionData);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toHaveClass('border-red-300');
    expect(passwordInput).toHaveClass('border-red-300');
  });

  it('should show general error message', () => {
    const actionData = {
      error: 'Invalid email or password',
    };

    renderLoginForm(actionData);

    expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
  });

  it('should have working form interactions', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const rememberCheckbox = screen.getByRole('checkbox', {
      name: /remember me/i,
    });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(rememberCheckbox);

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
    expect(rememberCheckbox).toBeChecked();
  });

  it('should have link to signup page', () => {
    renderLoginForm();

    expect(
      screen.getByRole('link', { name: /start hoarding links/i })
    ).toHaveAttribute('href', '/signup');
  });

  it('should have forgot password link', () => {
    renderLoginForm();

    expect(
      screen.getByRole('link', { name: /forgot password/i })
    ).toBeInTheDocument();
  });
});
