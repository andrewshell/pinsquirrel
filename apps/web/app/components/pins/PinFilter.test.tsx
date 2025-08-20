import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PinFilter } from './PinFilter'

// Helper function to render with router context
const renderWithRouter = (initialEntry = '/testuser/pins') => {
  const router = createMemoryRouter(
    [
      {
        path: '/:username/pins',
        element: <PinFilter />,
      },
    ],
    {
      initialEntries: [initialEntry],
    }
  )
  return {
    ...render(<RouterProvider router={router} />),
    router,
  }
}

describe('PinFilter', () => {
  it('renders both filter links', () => {
    renderWithRouter('/testuser/pins')

    // Should have desktop links for All and To Read
    expect(screen.getByRole('link', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'To Read' })).toBeInTheDocument()
  })

  it('shows All link as active when on pins route', () => {
    renderWithRouter('/testuser/pins')

    const allLinks = screen.getAllByRole('link', { name: 'All' })
    const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

    // Desktop All link should have default variant styling (active)
    expect(allLinks[0]).toHaveClass('bg-primary')
    // Desktop To Read link should have outline variant styling (inactive)
    expect(toReadLinks[0]).toHaveClass('bg-background')
  })

  it('shows To Read link as active when unread=true query param is set', () => {
    renderWithRouter('/testuser/pins?unread=true')

    const allLinks = screen.getAllByRole('link', { name: 'All' })
    const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

    // Desktop To Read link should be active
    expect(toReadLinks[0]).toHaveClass('bg-primary')
    // Desktop All link should be inactive
    expect(allLinks[0]).toHaveClass('bg-background')
  })

  it('has correct href attributes for navigation', () => {
    renderWithRouter('/testuser/pins')

    const allLinks = screen.getAllByRole('link', { name: 'All' })
    const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

    // Check desktop links
    expect(allLinks[0]).toHaveAttribute('href', '/testuser/pins')
    expect(toReadLinks[0]).toHaveAttribute('href', '/testuser/pins?unread=true')

    // Check mobile dropdown links (if they exist)
    if (allLinks.length > 1) {
      expect(allLinks[1]).toHaveAttribute('href', '/testuser/pins')
      expect(toReadLinks[1]).toHaveAttribute(
        'href',
        '/testuser/pins?unread=true'
      )
    }
  })

  it('extracts username correctly from different route patterns', () => {
    renderWithRouter('/anotheruser/pins?unread=true')

    const allLinks = screen.getAllByRole('link', { name: 'All' })
    const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

    // Links should use the correct username from the current route
    expect(allLinks[0]).toHaveAttribute('href', '/anotheruser/pins')
    expect(toReadLinks[0]).toHaveAttribute(
      'href',
      '/anotheruser/pins?unread=true'
    )
  })

  it('applies custom className when provided', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/:username/pins',
          element: <PinFilter className="custom-class" />,
        },
      ],
      {
        initialEntries: ['/testuser/pins'],
      }
    )

    render(
      <div data-testid="wrapper">
        <RouterProvider router={router} />
      </div>
    )

    const filterContainer = screen.getByTestId('wrapper').querySelector('div')
    expect(filterContainer).toHaveClass('custom-class')
  })

  it('shows mobile current filter label correctly', () => {
    renderWithRouter('/testuser/pins')
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()

    renderWithRouter('/testuser/pins?unread=true')
    expect(screen.getByRole('button', { name: 'To Read' })).toBeInTheDocument()
  })

  it('has accessible link roles and proper navigation structure', () => {
    renderWithRouter('/testuser/pins')

    const links = screen.getAllByRole('link')
    // Desktop shows 2 links (All, To Read), mobile dropdown links are not visible in DOM until opened
    expect(links).toHaveLength(2)

    // All links should be enabled and have proper href attributes
    links.forEach(link => {
      expect(link).toBeEnabled()
      expect(link.getAttribute('href')).toMatch(/^\/testuser\/pins/)
    })
  })

  it('renders dropdown menu trigger button for mobile', () => {
    renderWithRouter('/testuser/pins')

    const dropdownTrigger = screen.getByRole('button', { name: '' })
    expect(dropdownTrigger).toBeInTheDocument()
    expect(dropdownTrigger.querySelector('svg')).toBeInTheDocument() // MoreHorizontal icon
  })
})
