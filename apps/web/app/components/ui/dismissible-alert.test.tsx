import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DismissibleAlert } from './dismissible-alert'

describe('DismissibleAlert', () => {
  it('renders success alert with correct styling', () => {
    render(
      <DismissibleAlert message="Success message" type="success" />
    )
    
    expect(screen.getByText('Success message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50', 'border-green-200', 'text-green-800')
  })

  it('renders error alert with correct styling', () => {
    render(
      <DismissibleAlert message="Error message" type="error" />
    )
    
    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50', 'border-red-200')
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const mockOnDismiss = vi.fn()
    render(
      <DismissibleAlert 
        message="Test message" 
        type="success" 
        onDismiss={mockOnDismiss}
      />
    )
    
    const dismissButton = screen.getByRole('button', { name: 'Dismiss success message' })
    fireEvent.click(dismissButton)
    
    expect(mockOnDismiss).toHaveBeenCalledOnce()
  })

  it('does not render when show is false', () => {
    render(
      <DismissibleAlert 
        message="Hidden message" 
        type="success" 
        show={false}
      />
    )
    
    expect(screen.queryByText('Hidden message')).not.toBeInTheDocument()
  })

  it('uses internal show state when external show not provided', () => {
    render(
      <DismissibleAlert message="Test message" type="success" />
    )
    
    expect(screen.getByText('Test message')).toBeInTheDocument()
    
    // Click dismiss button - should hide the alert
    const dismissButton = screen.getByRole('button', { name: 'Dismiss success message' })
    fireEvent.click(dismissButton)
    
    expect(screen.queryByText('Test message')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <DismissibleAlert 
        message="Test message" 
        type="success" 
        className="custom-class"
      />
    )
    
    expect(screen.getByRole('alert')).toHaveClass('custom-class')
  })
})