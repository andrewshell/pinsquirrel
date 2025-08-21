import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchIcon } from './SearchIcon'

describe('SearchIcon', () => {
  const mockOnClick = vi.fn()

  beforeEach(() => {
    mockOnClick.mockClear()
  })

  it('should render search icon button', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    const button = screen.getByRole('button', { name: /search/i })
    expect(button).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    const button = screen.getByRole('button', { name: /search/i })
    fireEvent.click(button)

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('should have correct accessibility attributes', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    const button = screen.getByRole('button', { name: /search/i })
    expect(button).toHaveAttribute('aria-label', 'Search pins')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('should render Lucide search icon', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    // Lucide icons are rendered as SVG elements
    const icon = screen.getByRole('button').querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should apply correct styling classes', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    const button = screen.getByRole('button', { name: /search/i })
    expect(button).toHaveClass(
      'p-2',
      'text-foreground',
      'hover:bg-accent',
      'rounded-md',
      'transition-colors'
    )
  })

  it('should be keyboard accessible', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    const button = screen.getByRole('button', { name: /search/i })
    button.focus()
    fireEvent.keyDown(button, { key: 'Enter' })

    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('should show close icon when search is visible', () => {
    render(<SearchIcon onClick={mockOnClick} isSearchVisible={true} />)

    const button = screen.getByRole('button', { name: /close search/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Close search')
  })

  it('should show search icon when search is not visible', () => {
    render(<SearchIcon onClick={mockOnClick} isSearchVisible={false} />)

    const button = screen.getByRole('button', { name: /search pins/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Search pins')
  })

  it('should default to search icon when isSearchVisible prop is not provided', () => {
    render(<SearchIcon onClick={mockOnClick} />)

    const button = screen.getByRole('button', { name: /search pins/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Search pins')
  })
})
