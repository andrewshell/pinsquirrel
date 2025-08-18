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

    // Should have multiple All and To Read buttons (desktop + mobile)
    expect(screen.getAllByRole('button', { name: 'All' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'To Read' })).toHaveLength(1)
  })

  it('shows All button as active by default', () => {
    renderWithRouter()

    const allButtons = screen.getAllByRole('button', { name: 'All' })
    const toReadButtons = screen.getAllByRole('button', { name: 'To Read' })

    // Desktop All button should have default variant styling
    expect(allButtons[0].className).toContain('bg-primary')
    // Desktop To Read button should have outline variant styling
    expect(toReadButtons[0].className).toContain('bg-background')
  })

  it('shows To Read button as active when filter=toread in URL', () => {
    renderWithRouter('/?filter=toread')

    const allButtons = screen.getAllByRole('button', { name: 'All' })
    const toReadButtons = screen.getAllByRole('button', { name: 'To Read' })

    // Desktop To Read button should be active
    expect(toReadButtons[0].className).toContain('bg-primary')
    // Desktop All button should be inactive
    expect(allButtons[0].className).toContain('bg-background')
  })

  it('updates URL when All button is clicked from toread filter', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?filter=toread&page=2')

    const allButtons = screen.getAllByRole('button', { name: 'All' })
    // Click the desktop button (first one)
    await user.click(allButtons[0])

    // Should remove filter param and reset page
    expect(router.state.location.search).toBe('')
  })

  it('updates URL when To Read button is clicked', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?page=2')

    const toReadButtons = screen.getAllByRole('button', { name: 'To Read' })
    // Click the desktop button (first one)
    await user.click(toReadButtons[0])

    // Should add filter param and reset page
    expect(router.state.location.search).toBe('?filter=toread')
  })

  it('resets page parameter when filter changes', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?page=5')

    const toReadButtons = screen.getAllByRole('button', { name: 'To Read' })
    // Click the desktop button (first one)
    await user.click(toReadButtons[0])

    // Page parameter should be removed
    expect(router.state.location.search).toBe('?filter=toread')
  })

  it('preserves other search params when changing filter', async () => {
    const user = userEvent.setup()
    const { router } = renderWithRouter('/?pageSize=50&sort=date')

    const toReadButtons = screen.getAllByRole('button', { name: 'To Read' })
    // Click the desktop button (first one)
    await user.click(toReadButtons[0])

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
    // Should have desktop buttons (All, To Read) + mobile buttons (All disabled, ...)
    expect(buttons).toHaveLength(4)

    // Desktop buttons should be enabled
    expect(buttons[0]).toBeEnabled() // Desktop All
    expect(buttons[1]).toBeEnabled() // Desktop To Read
    // Mobile All button shows current state (now enabled)
    expect(buttons[2]).toBeEnabled() // Mobile All (current state)
    expect(buttons[3]).toBeEnabled() // Mobile dropdown trigger
  })

  it('handles edge case with invalid filter parameter', () => {
    renderWithRouter('/?filter=invalid')

    // Should default to All being active (bg-primary for default variant)
    const allButtons = screen.getAllByRole('button', { name: 'All' })
    const toReadButtons = screen.getAllByRole('button', { name: 'To Read' })

    // Desktop All button should be active (default variant)
    expect(allButtons[0].className).toContain('bg-primary')
    // Desktop To Read button should be inactive (outline variant)
    expect(toReadButtons[0].className).toContain('bg-background')
  })
})
