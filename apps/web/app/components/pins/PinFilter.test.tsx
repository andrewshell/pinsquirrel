import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PinFilter } from './PinFilter'

// Helper function to render with router context
const renderWithRouter = (initialEntry = '/') => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
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
  it('renders both filter buttons', () => {
    renderWithRouter()

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To Read' })).toBeInTheDocument()
  })

  it('shows All button as active by default', () => {
    renderWithRouter()

    const allButton = screen.getByRole('button', { name: 'All' })
    const toReadButton = screen.getByRole('button', { name: 'To Read' })

    // Active button should have default variant styling
    expect(allButton.className).toContain('bg-primary')
    // Inactive button should have outline variant styling
    expect(toReadButton.className).toContain('bg-background')
  })

  it('shows To Read button as active when filter=toread in URL', () => {
    renderWithRouter('/?filter=toread')

    const allButton = screen.getByRole('button', { name: 'All' })
    const toReadButton = screen.getByRole('button', { name: 'To Read' })

    // To Read button should be active
    expect(toReadButton.className).toContain('bg-primary')
    // All button should be inactive
    expect(allButton.className).toContain('bg-background')
  })

  it('updates URL when All button is clicked from toread filter', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?filter=toread&page=2')

    const allButton = screen.getByRole('button', { name: 'All' })
    await user.click(allButton)

    // Should remove filter param and reset page
    expect(router.state.location.search).toBe('')
  })

  it('updates URL when To Read button is clicked', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?page=2')

    const toReadButton = screen.getByRole('button', { name: 'To Read' })
    await user.click(toReadButton)

    // Should add filter param and reset page
    expect(router.state.location.search).toBe('?filter=toread')
  })

  it('resets page parameter when filter changes', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?page=5')

    const toReadButton = screen.getByRole('button', { name: 'To Read' })
    await user.click(toReadButton)

    // Page parameter should be removed
    expect(router.state.location.search).toBe('?filter=toread')
  })

  it('preserves other search params when changing filter', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?pageSize=50&sort=date')

    const toReadButton = screen.getByRole('button', { name: 'To Read' })
    await user.click(toReadButton)

    // Should preserve other params except page
    const searchParams = new URLSearchParams(router.state.location.search)
    expect(searchParams.get('filter')).toBe('toread')
    expect(searchParams.get('pageSize')).toBe('50')
    expect(searchParams.get('sort')).toBe('date')
    expect(searchParams.get('page')).toBeNull()
  })

  it('applies custom className when provided', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <PinFilter className="custom-class" />,
        },
      ],
      {
        initialEntries: ['/'],
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

  it('has accessible button roles', () => {
    renderWithRouter()

    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)

    buttons.forEach(button => {
      expect(button).toBeEnabled()
    })
  })

  it('handles edge case with invalid filter parameter', () => {
    renderWithRouter('/?filter=invalid')

    // Should default to All being active (bg-primary for default variant)
    const allButton = screen.getByRole('button', { name: 'All' })
    const toReadButton = screen.getByRole('button', { name: 'To Read' })

    // All button should be active (default variant)
    expect(allButton.className).toContain('bg-primary')
    // To Read button should be inactive (outline variant)
    expect(toReadButton.className).toContain('bg-background')
  })
})
