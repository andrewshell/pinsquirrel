import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Header } from './header';
import type { AuthenticatedUser } from '~/lib/auth-utils';

describe('Header Component', () => {
  const renderHeader = (user?: AuthenticatedUser | null) => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <div>
              <Header user={user} />
              <div>Home Page Content</div>
            </div>
          ),
        },
        {
          path: '/login',
          element: <div>Login Page</div>,
        },
        {
          path: '/signup',
          element: <div>Signup Page</div>,
        },
        {
          path: '/links',
          element: <div>Links Page</div>,
        },
      ],
      {
        initialEntries: ['/'],
      }
    );

    return render(<RouterProvider router={router} />);
  };

  it('should render the PinSquirrel logo/brand link', () => {
    renderHeader();

    const logoLink = screen.getByRole('link', { name: /pinsquirrel/i });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute('href', '/');
  });

  describe('when user is not authenticated', () => {
    it('should render login button', () => {
      renderHeader();

      const loginButton = screen.getByRole('link', { name: /login/i });
      expect(loginButton).toBeInTheDocument();
      expect(loginButton).toHaveAttribute('href', '/login');
    });

    it('should render signup button', () => {
      renderHeader();

      const signupButton = screen.getByRole('link', { name: /sign up/i });
      expect(signupButton).toBeInTheDocument();
      expect(signupButton).toHaveAttribute('href', '/signup');
    });

    it('should not render logout or add link buttons', () => {
      renderHeader();

      expect(
        screen.queryByRole('button', { name: /logout/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /add link/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('when user is authenticated', () => {
    const mockUser: AuthenticatedUser = {
      id: 1,
      email: 'test@example.com',
    };

    it('should render add link button', () => {
      renderHeader(mockUser);

      const addLinkButton = screen.getByRole('link', { name: /add link/i });
      expect(addLinkButton).toBeInTheDocument();
      expect(addLinkButton).toHaveAttribute('href', '/links');
    });

    it('should render logout button', () => {
      renderHeader(mockUser);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
      expect(logoutButton).toHaveAttribute('type', 'submit');
    });

    it('should not render login or signup buttons', () => {
      renderHeader(mockUser);

      expect(
        screen.queryByRole('link', { name: /login/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /sign up/i })
      ).not.toBeInTheDocument();
    });
  });

  it('should have proper styling classes', () => {
    renderHeader();

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('border-b', 'bg-white');

    const logoLink = screen.getByRole('link', { name: /pinsquirrel/i });
    expect(logoLink).toHaveClass('text-xl', 'font-bold', 'text-gray-900');
  });

  it('should have navigation structure', () => {
    renderHeader();

    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('flex', 'items-center', 'gap-4');

    // Check that both login and signup buttons are within navigation
    const loginButton = screen.getByRole('link', { name: /login/i });
    const signupButton = screen.getByRole('link', { name: /sign up/i });

    expect(nav).toContainElement(loginButton);
    expect(nav).toContainElement(signupButton);
  });

  it('should use Button component variants correctly for unauthenticated state', () => {
    renderHeader();

    const loginButton = screen.getByRole('link', { name: /login/i });
    const signupButton = screen.getByRole('link', { name: /sign up/i });

    // Login button should have outline variant styling
    expect(loginButton).toHaveClass('border', 'bg-background', 'shadow-xs');

    // Signup button should have default/primary variant styling
    expect(signupButton).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should have accessible header landmark', () => {
    renderHeader();

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('should have container layout structure', () => {
    renderHeader();

    const header = screen.getByRole('banner');
    const container = header.querySelector('.container');

    expect(container).toBeInTheDocument();
    expect(container).toHaveClass(
      'mx-auto',
      'px-4',
      'py-4',
      'flex',
      'items-center',
      'justify-between'
    );
  });
});
