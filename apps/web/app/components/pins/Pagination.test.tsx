import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pagination } from './Pagination'

interface MockLinkProps {
  to: string
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

// Mock React Router Link component
vi.mock('react-router', () => ({
  Link: ({ to, children, className, 'aria-label': ariaLabel }: MockLinkProps) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

describe('Pagination', () => {
  it('renders pagination info and controls when multiple pages exist', () => {
    render(
      <Pagination 
        currentPage={2} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    // Should show pagination info
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
    expect(screen.getByText('125 total pins')).toBeInTheDocument()

    // Should show navigation controls (check both versions exist)
    const prevButtons = screen.getAllByLabelText(/Go to previous page/)
    const nextButtons = screen.getAllByLabelText(/Go to next page/)
    
    expect(prevButtons.length).toBeGreaterThan(0)
    expect(nextButtons.length).toBeGreaterThan(0)
  })

  it('does not render when there is only one page', () => {
    render(
      <Pagination 
        currentPage={1} 
        totalPages={1} 
        totalCount={10} 
      />
    )

    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Go to previous page' })).not.toBeInTheDocument()
  })

  it('disables previous button on first page', () => {
    render(
      <Pagination 
        currentPage={1} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    const prevButton = screen.getByLabelText('Go to previous page')
    expect(prevButton).toHaveAttribute('aria-disabled', 'true')
    expect(prevButton).toHaveClass('pointer-events-none', 'opacity-50')
  })

  it('disables next button on last page', () => {
    render(
      <Pagination 
        currentPage={5} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    const nextButton = screen.getByLabelText('Go to next page')
    expect(nextButton).toHaveAttribute('aria-disabled', 'true')
    expect(nextButton).toHaveClass('pointer-events-none', 'opacity-50')
  })

  it('generates correct URLs for navigation', () => {
    render(
      <Pagination 
        currentPage={3} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    const prevButton = screen.getByLabelText('Go to previous page')
    const nextButton = screen.getByLabelText('Go to next page')

    expect(prevButton).toHaveAttribute('href', '/pins?page=2')
    expect(nextButton).toHaveAttribute('href', '/pins?page=4')
  })

  it('shows page numbers for small ranges', () => {
    render(
      <Pagination 
        currentPage={2} 
        totalPages={4} 
        totalCount={100} 
      />
    )

    // Should show all page numbers for small ranges
    expect(screen.getByRole('link', { name: 'Go to page 1' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Current page (not a link)
    expect(screen.getByRole('link', { name: 'Go to page 3' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to page 4' })).toBeInTheDocument()
  })

  it('shows ellipsis for large page ranges', () => {
    render(
      <Pagination 
        currentPage={10} 
        totalPages={20} 
        totalCount={500} 
      />
    )

    // Should show ellipsis for large ranges (may have multiple)
    const ellipses = screen.getAllByText('…')
    expect(ellipses.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: 'Go to page 1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to page 20' })).toBeInTheDocument()
  })

  it('handles edge case with no items', () => {
    render(
      <Pagination 
        currentPage={1} 
        totalPages={1} 
        totalCount={0} 
      />
    )

    // Should not render pagination for empty results
    expect(screen.queryByText('Page 1 of 1')).not.toBeInTheDocument()
  })

  it('renders correct singular/plural text for total count', () => {
    const { rerender } = render(
      <Pagination 
        currentPage={1} 
        totalPages={2} 
        totalCount={1} 
      />
    )

    expect(screen.getByText('1 total pin')).toBeInTheDocument()

    rerender(
      <Pagination 
        currentPage={1} 
        totalPages={2} 
        totalCount={25} 
      />
    )

    expect(screen.getByText('25 total pins')).toBeInTheDocument()
  })

  it('applies correct CSS classes for layout', () => {
    render(
      <Pagination 
        currentPage={2} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    const paginationContainer = screen.getByRole('navigation')
    expect(paginationContainer).toHaveClass('flex', 'items-center', 'justify-between', 'px-4', 'py-3', 'sm:px-6')
  })

  it('has proper accessibility attributes', () => {
    render(
      <Pagination 
        currentPage={2} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveAttribute('aria-label', 'Pagination navigation')

    // Check navigation buttons exist
    const prevButtons = screen.getAllByLabelText(/Go to previous page/)
    const nextButtons = screen.getAllByLabelText(/Go to next page/)
    
    expect(prevButtons.length).toBeGreaterThan(0)
    expect(nextButtons.length).toBeGreaterThan(0)
  })

  it('shows current page as non-interactive text', () => {
    render(
      <Pagination 
        currentPage={3} 
        totalPages={5} 
        totalCount={125} 
      />
    )

    // Current page should be displayed as text, not a link
    const currentPageElement = screen.getByText('3')
    expect(currentPageElement).not.toHaveAttribute('href')
    expect(currentPageElement).toHaveAttribute('aria-current', 'page')
  })

  it('generates page numbers correctly for different ranges', () => {
    // Test beginning range
    const { rerender } = render(
      <Pagination 
        currentPage={2} 
        totalPages={10} 
        totalCount={250} 
      />
    )

    expect(screen.getByRole('link', { name: 'Go to page 1' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // Current page
    expect(screen.getByRole('link', { name: 'Go to page 3' })).toBeInTheDocument()

    // Test middle range
    rerender(
      <Pagination 
        currentPage={5} 
        totalPages={10} 
        totalCount={250} 
      />
    )

    expect(screen.getByRole('link', { name: 'Go to page 4' })).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // Current page
    expect(screen.getByRole('link', { name: 'Go to page 6' })).toBeInTheDocument()

    // Test end range
    rerender(
      <Pagination 
        currentPage={9} 
        totalPages={10} 
        totalCount={250} 
      />
    )

    expect(screen.getByRole('link', { name: 'Go to page 8' })).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument() // Current page
    expect(screen.getByRole('link', { name: 'Go to page 10' })).toBeInTheDocument()
  })
})