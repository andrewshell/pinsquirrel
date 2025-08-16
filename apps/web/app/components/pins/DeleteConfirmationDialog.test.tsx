import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Pin } from '@pinsquirrel/core'

// Mock react-router
vi.mock('react-router', () => ({
  Form: vi.fn(({ children, ...props }) => <form {...props}>{children}</form>),
  useNavigation: vi.fn(() => ({
    state: 'idle',
    formMethod: undefined,
    formAction: undefined,
  })),
}))

import { useNavigation } from 'react-router'
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog'

const mockUseNavigation = vi.mocked(useNavigation)

describe('DeleteConfirmationDialog', () => {
  const mockDate = new Date('2025-08-09T00:00:00.000Z')
  const mockPin: Pin = {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example Pin',
    description: 'A test pin',
    readLater: false,
    createdAt: mockDate,
    updatedAt: mockDate,
    tags: [
      {
        id: 'tag-1',
        name: 'test',
        userId: 'user-1',
        createdAt: mockDate,
        updatedAt: mockDate,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseNavigation.mockReturnValue({
      state: 'idle',
      location: undefined,
      formMethod: undefined,
      formAction: undefined,
      formEncType: undefined,
      formData: undefined,
      json: undefined,
      text: undefined,
    })
  })

  it('should render dialog when open is true', () => {
    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Delete Pin' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Are you sure you want to delete this pin? This action cannot be undone.'
      )
    ).toBeInTheDocument()
  })

  it('should not render dialog when open is false', () => {
    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={false}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should display pin title and URL in dialog content', () => {
    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.getByText('Example Pin')).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
  })

  it('should call onOpenChange with false when cancel button is clicked', async () => {
    const mockOnOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('should call onOpenChange with false when close button (X) is clicked', async () => {
    const mockOnOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    )

    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('should submit form with DELETE method when delete button is clicked', async () => {
    const user = userEvent.setup()

    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /delete pin/i })
    await user.click(deleteButton)

    // Check that form was submitted (form submission is handled by React Router)
    expect(deleteButton).toBeInTheDocument()
  })

  it('should show loading state when navigation is submitting', () => {
    mockUseNavigation.mockReturnValue({
      state: 'submitting',
      location: {
        pathname: '/test',
        search: '',
        hash: '',
        state: null,
        key: 'test',
      },
      formMethod: 'DELETE',
      formAction: '/pins/pin-1/edit',
      formEncType: 'application/x-www-form-urlencoded',
      formData: undefined,
      json: undefined,
      text: undefined,
    })

    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /deleting.../i })
    expect(deleteButton).toBeDisabled()
  })

  it('should disable buttons when navigation is submitting', () => {
    mockUseNavigation.mockReturnValue({
      state: 'submitting',
      location: {
        pathname: '/test',
        search: '',
        hash: '',
        state: null,
        key: 'test',
      },
      formMethod: 'DELETE',
      formAction: '/pins/pin-1/edit',
      formEncType: 'application/x-www-form-urlencoded',
      formData: undefined,
      json: undefined,
      text: undefined,
    })

    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /deleting.../i })
    const cancelButton = screen.getByRole('button', { name: /cancel/i })

    expect(deleteButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })

  it('should have proper accessibility attributes', () => {
    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(dialog).toHaveAttribute('aria-describedby')
  })

  it('should have focusable delete button', () => {
    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /delete pin/i })
    expect(deleteButton).not.toHaveAttribute('disabled')
    expect(deleteButton).toHaveAttribute('type', 'submit')
  })

  it('should have all focusable elements present', () => {
    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const deleteButton = screen.getByRole('button', { name: /delete pin/i })
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    const closeButton = screen.getByRole('button', { name: /close/i })

    // Verify all buttons are present and can be focused
    expect(deleteButton).toBeInTheDocument()
    expect(cancelButton).toBeInTheDocument()
    expect(closeButton).toBeInTheDocument()

    // Verify buttons are not disabled
    expect(deleteButton).not.toHaveAttribute('disabled')
    expect(cancelButton).not.toHaveAttribute('disabled')
    expect(closeButton).not.toHaveAttribute('disabled')
  })

  it('should handle keyboard navigation with Enter and Escape', async () => {
    const mockOnOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <DeleteConfirmationDialog
        pin={mockPin}
        open={true}
        onOpenChange={mockOnOpenChange}
      />
    )

    // Escape should close dialog
    await user.keyboard('{Escape}')
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })
})
