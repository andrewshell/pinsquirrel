import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PinCard } from './PinCard'
import type { Pin } from '@pinsquirrel/core'

describe('PinCard', () => {
  const mockPin: Pin = {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example Pin',
    description: 'This is a test pin description',
    readLater: false,
    contentPath: null,
    imagePath: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    tags: [
      {
        id: 'tag-1',
        userId: 'user-1',
        name: 'javascript',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'tag-2',
        userId: 'user-1',
        name: 'react',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }

  it('renders pin title correctly', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
  })

  it('displays full URL', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
  })

  it('displays description when present', () => {
    render(<PinCard pin={mockPin} />)
    const description = screen.getByTestId('pin-description')
    expect(description).toHaveTextContent('This is a test pin description')
  })

  it('shows all associated tags as badges', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('hides description when not provided', () => {
    const pinWithoutDesc = { ...mockPin, description: null }
    render(<PinCard pin={pinWithoutDesc} />)
    expect(screen.queryByTestId('pin-description')).not.toBeInTheDocument()
  })

  it('renders action buttons appropriately', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByLabelText('Edit Example Pin')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Example Pin')).toBeInTheDocument()
  })

  it('handles pins with no tags', () => {
    const pinWithoutTags = { ...mockPin, tags: [] }
    render(<PinCard pin={pinWithoutTags} />)
    expect(screen.queryByTestId('pin-tags')).not.toBeInTheDocument()
  })

  it('handles invalid URLs gracefully', () => {
    const pinWithInvalidUrl = { ...mockPin, url: 'not-a-valid-url' }
    render(<PinCard pin={pinWithInvalidUrl} />)
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument()
  })

  it('displays full URL including www and path', () => {
    const pinWithWww = { ...mockPin, url: 'https://www.example.com/path' }
    render(<PinCard pin={pinWithWww} />)
    expect(screen.getByText('https://www.example.com/path')).toBeInTheDocument()
  })

  it('handles empty description with null value', () => {
    const pinWithNullDesc = { ...mockPin, description: null }
    render(<PinCard pin={pinWithNullDesc} />)
    expect(screen.queryByTestId('pin-description')).not.toBeInTheDocument()
  })

  it('renders action buttons as text links with proper accessibility', () => {
    render(<PinCard pin={mockPin} />)
    const editButton = screen.getByLabelText('Edit Example Pin')
    const deleteButton = screen.getByLabelText('Delete Example Pin')

    expect(editButton).toHaveTextContent('edit')
    expect(deleteButton).toHaveTextContent('delete')
    expect(editButton).toHaveClass('text-xs', 'text-blue-600')
    expect(deleteButton).toHaveClass('text-xs', 'text-blue-600')
  })

  it('displays relative time correctly', () => {
    // Create a pin from 2 days ago
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const pinWithOldDate = { ...mockPin, createdAt: twoDaysAgo }

    render(<PinCard pin={pinWithOldDate} />)
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })
})
