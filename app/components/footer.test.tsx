import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Footer } from './footer';

describe('Footer Component', () => {
  const renderFooter = () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <div>
              <div>Main Content</div>
              <Footer />
            </div>
          ),
        },
        {
          path: '/terms',
          element: <div>Terms of Service Page</div>,
        },
        {
          path: '/privacy',
          element: <div>Privacy Policy Page</div>,
        },
      ],
      {
        initialEntries: ['/'],
      }
    );

    return render(<RouterProvider router={router} />);
  };

  // Mock Date to have consistent copyright year testing
  const originalDate = Date;
  const mockDate = (year: number) => {
    const MockedDate = vi.fn(() => ({ getFullYear: () => year })) as any;
    MockedDate.getFullYear = vi.fn(() => year);
    MockedDate.now = vi.fn(() => new originalDate(`${year}-01-01`).getTime());
    global.Date = MockedDate;
  };

  afterEach(() => {
    global.Date = originalDate;
  });

  it('should render terms of service link', () => {
    renderFooter();

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute('href', '/terms');
  });

  it('should render privacy policy link', () => {
    renderFooter();

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('should display current year in copyright', () => {
    mockDate(2024);
    renderFooter();

    expect(screen.getByText(/© 2024 Andrew Shell LLC/i)).toBeInTheDocument();
  });

  it('should update copyright year dynamically', () => {
    mockDate(2025);
    renderFooter();

    expect(screen.getByText(/© 2025 Andrew Shell LLC/i)).toBeInTheDocument();
  });

  it('should display company information', () => {
    renderFooter();

    expect(screen.getByText(/Andrew Shell LLC/i)).toBeInTheDocument();
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    renderFooter();

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveClass('border-t', 'bg-gray-50', 'mt-auto');

    const linksContainer = screen.getByRole('link', {
      name: /terms/i,
    }).parentElement;
    expect(linksContainer).toHaveClass(
      'flex',
      'items-center',
      'justify-center',
      'gap-6'
    );
  });

  it('should have hover effects on links', () => {
    renderFooter();

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    const privacyLink = screen.getByRole('link', { name: /privacy policy/i });

    expect(termsLink).toHaveClass('hover:text-gray-900');
    expect(privacyLink).toHaveClass('hover:text-gray-900');
  });

  it('should have accessible footer landmark', () => {
    renderFooter();

    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });

  it('should have container layout structure', () => {
    renderFooter();

    const footer = screen.getByRole('contentinfo');
    const container = footer.querySelector('.container');

    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('mx-auto', 'px-4', 'py-6');
  });

  it('should have proper text sizing and colors', () => {
    renderFooter();

    const termsLink = screen.getByRole('link', { name: /terms of service/i });
    const linksContainer = termsLink.parentElement;
    expect(linksContainer).toHaveClass('text-sm', 'text-gray-600');

    const copyrightText = screen.getByText(/© .* Andrew Shell LLC/i);
    expect(copyrightText).toHaveClass(
      'text-center',
      'text-xs',
      'text-gray-500'
    );
  });

  it('should separate links and copyright sections', () => {
    renderFooter();

    const copyrightText = screen.getByText(/© .* Andrew Shell LLC/i);
    expect(copyrightText).toHaveClass('mt-4');
  });
});
