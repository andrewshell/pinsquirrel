import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Pin } from '@pinsquirrel/domain'
import { PinList } from './PinList'

// Mock the PinCard component
vi.mock('./PinCard', () => ({
  PinCard: ({ pin }: { pin: Pin }) => (
    <div data-testid={`pin-card-${pin.id}`}>Mock PinCard: {pin.title}</div>
  ),
}))

// Mock the EmptyState component
vi.mock('./EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">Mock EmptyState</div>,
}))

describe('PinList', () => {
  const mockPins: Pin[] = [
    {
      id: 'pin-1',
      userId: 'user-1',
      url: 'https://example.com',
      title: 'First Pin',
      description: 'First description',
      readLater: false,
      tagNames: ['react'],
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
    },
    {
      id: 'pin-2',
      userId: 'user-1',
      url: 'https://example2.com',
      title: 'Second Pin',
      description: null,
      readLater: true,
      tagNames: [],
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-02'),
    },
    {
      id: 'pin-3',
      userId: 'user-1',
      url: 'https://example3.com',
      title: 'Third Pin',
      description: 'Third description',
      readLater: false,
      tagNames: ['javascript', 'tutorial'],
      createdAt: new Date('2025-01-03'),
      updatedAt: new Date('2025-01-03'),
    },
  ]

  it('renders empty state when no pins provided', () => {
    render(<PinList pins={[]} isLoading={false} />)

    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-list')).not.toBeInTheDocument()
  })

  it('renders pin cards in list layout when pins provided', () => {
    render(<PinList pins={mockPins} isLoading={false} />)

    // Should not show empty state
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()

    // Should show list container
    expect(screen.getByTestId('pin-list')).toBeInTheDocument()

    // Should render all pin cards
    expect(screen.getByTestId('pin-card-pin-1')).toBeInTheDocument()
    expect(screen.getByTestId('pin-card-pin-2')).toBeInTheDocument()
    expect(screen.getByTestId('pin-card-pin-3')).toBeInTheDocument()

    // Should show correct content
    expect(screen.getByText('Mock PinCard: First Pin')).toBeInTheDocument()
    expect(screen.getByText('Mock PinCard: Second Pin')).toBeInTheDocument()
    expect(screen.getByText('Mock PinCard: Third Pin')).toBeInTheDocument()
  })

  it('applies correct CSS classes for vertical list layout', () => {
    render(<PinList pins={mockPins} isLoading={false} />)

    const listContainer = screen.getByTestId('pin-list')
    expect(listContainer).toHaveClass('space-y-4')
  })

  it('shows loading state when isLoading is true', () => {
    render(<PinList pins={mockPins} isLoading={true} />)

    expect(screen.getByTestId('pin-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('empty-state')).not.toBeInTheDocument()
  })

  it('shows loading state with skeleton cards', () => {
    render(<PinList pins={[]} isLoading={true} />)

    const loadingContainer = screen.getByTestId('pin-list-loading')
    expect(loadingContainer).toBeInTheDocument()

    // Should show multiple skeleton cards
    const skeletonCards = screen.getAllByTestId(/pin-skeleton-/)
    expect(skeletonCards).toHaveLength(6) // Default skeleton count
  })

  it('shows loading state even when pins are provided', () => {
    // This tests the priority: loading state overrides pin display
    render(<PinList pins={mockPins} isLoading={true} />)

    expect(screen.getByTestId('pin-list-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-list')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pin-card-pin-1')).not.toBeInTheDocument()
  })

  it('handles single pin correctly', () => {
    const singlePin = [mockPins[0]]
    render(<PinList pins={singlePin} isLoading={false} />)

    expect(screen.getByTestId('pin-list')).toBeInTheDocument()
    expect(screen.getByTestId('pin-card-pin-1')).toBeInTheDocument()
    expect(screen.queryByTestId('pin-card-pin-2')).not.toBeInTheDocument()
  })

  it('maintains list layout with different numbers of pins', () => {
    // Test with 2 pins (should use vertical list layout)
    const twoPins = mockPins.slice(0, 2)
    render(<PinList pins={twoPins} isLoading={false} />)

    const listContainer = screen.getByTestId('pin-list')
    expect(listContainer).toHaveClass('space-y-4')
    expect(screen.getByTestId('pin-card-pin-1')).toBeInTheDocument()
    expect(screen.getByTestId('pin-card-pin-2')).toBeInTheDocument()
  })
})
