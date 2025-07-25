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
      { id: 'tag-1', userId: 'user-1', name: 'javascript', createdAt: new Date(), updatedAt: new Date() },
      { id: 'tag-2', userId: 'user-1', name: 'react', createdAt: new Date(), updatedAt: new Date() }
    ]
  }

  it('renders pin title correctly', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
  })

  it('displays URL with proper formatting', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByText('example.com')).toBeInTheDocument()
  })

  it('displays truncated description with ellipsis for long text', () => {
    const longDescription = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
    const pinWithLongDesc = { ...mockPin, description: longDescription }
    
    render(<PinCard pin={pinWithLongDesc} />)
    const description = screen.getByTestId('pin-description')
    expect(description).toHaveClass('line-clamp-3')
  })

  it('shows all associated tags as badges', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('shows placeholder when no description provided', () => {
    const pinWithoutDesc = { ...mockPin, description: null }
    render(<PinCard pin={pinWithoutDesc} />)
    expect(screen.getByText('No description')).toBeInTheDocument()
  })

  it('renders action buttons appropriately', () => {
    render(<PinCard pin={mockPin} />)
    expect(screen.getByLabelText('Edit pin')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete pin')).toBeInTheDocument()
  })

  it('handles pins with no tags', () => {
    const pinWithoutTags = { ...mockPin, tags: [] }
    render(<PinCard pin={pinWithoutTags} />)
    expect(screen.queryByTestId('pin-tags')).toBeEmptyDOMElement()
  })

  it('handles invalid URLs gracefully', () => {
    const pinWithInvalidUrl = { ...mockPin, url: 'not-a-valid-url' }
    render(<PinCard pin={pinWithInvalidUrl} />)
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument()
  })

  it('removes www from domain display', () => {
    const pinWithWww = { ...mockPin, url: 'https://www.example.com/path' }
    render(<PinCard pin={pinWithWww} />)
    expect(screen.getByText('example.com')).toBeInTheDocument()
  })

  it('handles empty description with null value', () => {
    const pinWithNullDesc = { ...mockPin, description: null }
    render(<PinCard pin={pinWithNullDesc} />)
    expect(screen.getByText('No description')).toBeInTheDocument()
  })

  it('renders action buttons with proper accessibility', () => {
    render(<PinCard pin={mockPin} />)
    const editButton = screen.getByLabelText('Edit pin')
    const deleteButton = screen.getByLabelText('Delete pin')
    
    expect(editButton).toHaveClass('h-8', 'w-8')
    expect(deleteButton).toHaveClass('h-8', 'w-8')
  })
})