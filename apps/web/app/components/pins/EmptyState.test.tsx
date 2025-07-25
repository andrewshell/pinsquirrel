import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('displays appropriate message when no pins exist', () => {
    render(<EmptyState />)
    expect(screen.getByText("You don't have any pins yet")).toBeInTheDocument()
  })

  it('shows call-to-action button to create first pin', () => {
    render(<EmptyState />)
    const ctaButton = screen.getByRole('button', { name: /create your first pin/i })
    expect(ctaButton).toBeInTheDocument()
  })

  it('renders correct icon', () => {
    render(<EmptyState />)
    expect(screen.getByTestId('empty-state-icon')).toBeInTheDocument()
  })

  it('has proper styling and layout', () => {
    render(<EmptyState />)
    const container = screen.getByTestId('empty-state-container')
    expect(container).toHaveClass('text-center')
  })

  it('displays descriptive help text', () => {
    render(<EmptyState />)
    expect(screen.getByText(/start saving your favorite links/i)).toBeInTheDocument()
  })

  it('has accessible button with proper role', () => {
    render(<EmptyState />)
    const button = screen.getByRole('button', { name: /create your first pin/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('icon has proper accessibility attributes', () => {
    render(<EmptyState />)
    const icon = screen.getByTestId('empty-state-icon')
    expect(icon).toHaveClass('h-16', 'w-16', 'rounded-full')
  })
})