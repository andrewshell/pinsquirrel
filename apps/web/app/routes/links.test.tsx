import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import Links from './links';

// Mock the auth utilities
vi.mock('~/lib/auth-utils', () => ({
  createAuthLoader: vi.fn(),
  createAuthAction: vi.fn(),
}));

vi.mock('~/lib/session', () => ({
  clearSessionCookie: vi.fn(() => 'session=; HttpOnly; Max-Age=0'),
}));

describe('Links Page Component', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com',
  };

  const renderLinksPage = (user = mockUser) => {
    const router = createMemoryRouter(
      [
        {
          path: '/links',
          element: (
            <Links
              loaderData={user}
              params={{}}
              matches={[
                {
                  id: 'root',
                  params: {},
                  pathname: '/',
                  data: { user: null },
                  handle: undefined,
                },
                {
                  id: 'routes/links',
                  params: {},
                  pathname: '/links',
                  data: user,
                  handle: undefined,
                },
              ]}
            />
          ),
          action: async () => null,
        },
        {
          path: '/links/reading-list',
          element: <div>Reading List</div>,
        },
        {
          path: '/links/favorites',
          element: <div>Favorites</div>,
        },
        {
          path: '/links/feeds',
          element: <div>Feeds</div>,
        },
      ],
      {
        initialEntries: ['/links'],
      }
    );

    return render(<RouterProvider router={router} />);
  };

  describe('Page Header', () => {
    it('should render page title', () => {
      renderLinksPage();

      expect(
        screen.getByRole('heading', { name: /my links/i, level: 1 })
      ).toBeInTheDocument();
    });

    it('should display welcome message with user email', () => {
      renderLinksPage();

      expect(
        screen.getByText('Welcome back, test@example.com!')
      ).toBeInTheDocument();
    });
  });

  describe('Sidebar Navigation', () => {
    it('should render collections section', () => {
      renderLinksPage();

      expect(
        screen.getByRole('heading', { name: /collections/i, level: 2 })
      ).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      renderLinksPage();

      expect(screen.getByRole('link', { name: /all links/i })).toHaveAttribute(
        'href',
        '/links'
      );
      expect(
        screen.getByRole('link', { name: /reading list/i })
      ).toHaveAttribute('href', '/links/reading-list');
      expect(screen.getByRole('link', { name: /favorites/i })).toHaveAttribute(
        'href',
        '/links/favorites'
      );
      expect(screen.getByRole('link', { name: /rss feeds/i })).toHaveAttribute(
        'href',
        '/links/feeds'
      );
    });

    it('should highlight current page (All Links)', () => {
      renderLinksPage();

      const allLinksLink = screen.getByRole('link', { name: /all links/i });
      expect(allLinksLink).toHaveClass('text-blue-600', 'bg-blue-50');
    });

    it('should render tags section', () => {
      renderLinksPage();

      expect(
        screen.getByRole('heading', { name: /tags/i, level: 3 })
      ).toBeInTheDocument();
      expect(screen.getByText('development')).toBeInTheDocument();
      expect(screen.getByText('design')).toBeInTheDocument();
      expect(screen.getByText('productivity')).toBeInTheDocument();
    });
  });

  describe('View Controls', () => {
    it('should render view toggle buttons', () => {
      renderLinksPage();

      expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument();
    });

    it('should render sort dropdown', () => {
      renderLinksPage();

      const sortSelect = screen.getByRole('combobox');
      expect(sortSelect).toBeInTheDocument();
      expect(screen.getByText('Sort by Date Added')).toBeInTheDocument();
    });

    it('should have different variants for view toggles', () => {
      renderLinksPage();

      const listButton = screen.getByRole('button', { name: /list/i });
      const gridButton = screen.getByRole('button', { name: /grid/i });

      expect(listButton).toHaveClass('border', 'bg-background'); // outline variant
      expect(gridButton).toHaveClass('hover:bg-accent'); // ghost variant
    });
  });

  describe('Links Content', () => {
    it('should render sample link', () => {
      renderLinksPage();

      expect(
        screen.getByText('Welcome to PinSquirrel - Getting Started Guide')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Learn how to make the most of your link hoarding/)
      ).toBeInTheDocument();
      expect(screen.getByText('pinsquirrel.com')).toBeInTheDocument();
      expect(screen.getByText('Added 2 days ago')).toBeInTheDocument();
    });

    it('should render link tags', () => {
      renderLinksPage();

      expect(screen.getByText('tutorial')).toBeInTheDocument();
      expect(screen.getByText('getting-started')).toBeInTheDocument();
    });

    it('should render link action buttons', () => {
      renderLinksPage();

      const actionButtons = screen.getAllByRole('button');
      const heartButton = actionButtons.find((btn) =>
        btn
          .querySelector('svg')
          ?.querySelector('path')
          ?.getAttribute('d')
          ?.includes('4.318 6.318')
      );
      const menuButton = actionButtons.find((btn) =>
        btn
          .querySelector('svg')
          ?.querySelector('path')
          ?.getAttribute('d')
          ?.includes('12 5v.01')
      );

      expect(heartButton).toBeInTheDocument();
      expect(menuButton).toBeInTheDocument();
    });

    it('should render empty state', () => {
      renderLinksPage();

      expect(screen.getByText('No more links')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Get started by adding your first link to your collection.'
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /add your first link/i })
      ).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should handle sort dropdown changes', async () => {
      const user = userEvent.setup();
      renderLinksPage();

      const sortSelect = screen.getByRole('combobox');

      await user.selectOptions(sortSelect, 'Sort by Title');
      expect(sortSelect).toHaveValue('Sort by Title');
    });
  });

  describe('Layout and Styling', () => {
    it('should have proper grid layout', () => {
      renderLinksPage();

      const gridContainer = screen.getByText('Collections').closest('.grid');
      expect(gridContainer).toHaveClass('lg:grid-cols-4');
    });

    it('should have responsive design classes', () => {
      renderLinksPage();

      const sidebar = screen
        .getByText('Collections')
        .closest('.lg\\:col-span-1');
      const mainContent = screen.getByText('List').closest('.lg\\:col-span-3');

      expect(sidebar).toBeInTheDocument();
      expect(mainContent).toBeInTheDocument();
    });

    it('should have proper spacing and styling', () => {
      renderLinksPage();

      const pageContainer = screen
        .getByRole('heading', { name: /my links/i })
        .closest('.container');
      expect(pageContainer).toHaveClass('mx-auto', 'px-4', 'py-6');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderLinksPage();

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); // My Links
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument(); // Collections
      expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3); // Tags, link title, empty state
    });

    it('should have navigation landmark', () => {
      renderLinksPage();

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('should have proper button roles', () => {
      renderLinksPage();

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });
  });
});
