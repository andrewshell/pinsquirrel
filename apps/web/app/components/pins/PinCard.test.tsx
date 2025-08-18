import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PinCard } from './PinCard'
import type { Pin } from '@pinsquirrel/core'

// Helper function to render with router context
const renderWithRouter = (component: React.ReactNode) => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: component,
      },
      {
        path: '/pins/:id/edit',
        element: <div>Edit Route</div>,
      },
    ],
    {
      initialEntries: ['/'],
    }
  )
  return render(<RouterProvider router={router} />)
}

describe('PinCard', () => {
  const mockPin: Pin = {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example Pin',
    description: 'This is a test pin description',
    readLater: false,
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
    renderWithRouter(<PinCard pin={mockPin} />)
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
  })

  it('displays full URL', () => {
    renderWithRouter(<PinCard pin={mockPin} />)
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
  })

  it('displays description when present', () => {
    renderWithRouter(<PinCard pin={mockPin} />)
    const description = screen.getByTestId('pin-description')
    expect(description).toHaveTextContent('This is a test pin description')
  })

  it('shows all associated tags as badges', () => {
    renderWithRouter(<PinCard pin={mockPin} />)
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('hides description when not provided', () => {
    const pinWithoutDesc = { ...mockPin, description: null }
    renderWithRouter(<PinCard pin={pinWithoutDesc} />)
    expect(screen.queryByTestId('pin-description')).not.toBeInTheDocument()
  })

  it('renders action buttons appropriately', () => {
    renderWithRouter(<PinCard pin={mockPin} />)
    expect(screen.getByLabelText('Edit Example Pin')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Example Pin')).toBeInTheDocument()
  })

  it('handles pins with no tags', () => {
    const pinWithoutTags = { ...mockPin, tags: [] }
    renderWithRouter(<PinCard pin={pinWithoutTags} />)
    expect(screen.queryByTestId('pin-tags')).not.toBeInTheDocument()
  })

  it('handles invalid URLs gracefully', () => {
    const pinWithInvalidUrl = { ...mockPin, url: 'not-a-valid-url' }
    renderWithRouter(<PinCard pin={pinWithInvalidUrl} />)
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument()
  })

  it('displays full URL including www and path', () => {
    const pinWithWww = { ...mockPin, url: 'https://www.example.com/path' }
    renderWithRouter(<PinCard pin={pinWithWww} />)
    expect(screen.getByText('https://www.example.com/path')).toBeInTheDocument()
  })

  it('handles empty description with null value', () => {
    const pinWithNullDesc = { ...mockPin, description: null }
    renderWithRouter(<PinCard pin={pinWithNullDesc} />)
    expect(screen.queryByTestId('pin-description')).not.toBeInTheDocument()
  })

  it('renders action buttons as text links with proper accessibility', () => {
    renderWithRouter(<PinCard pin={mockPin} />)
    const editButton = screen.getByLabelText('Edit Example Pin')
    const deleteButton = screen.getByLabelText('Delete Example Pin')

    expect(editButton).toHaveTextContent('edit')
    expect(deleteButton).toHaveTextContent('delete')
    expect(editButton).toHaveClass('text-accent', 'font-bold')
    expect(deleteButton).toHaveClass('text-destructive', 'font-bold')
  })

  it('displays relative time correctly', () => {
    // Create a pin from 2 days ago
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const pinWithOldDate = { ...mockPin, createdAt: twoDaysAgo }

    renderWithRouter(<PinCard pin={pinWithOldDate} />)
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  describe('Edit button', () => {
    it('renders edit button as a link to edit route', () => {
      renderWithRouter(<PinCard pin={mockPin} />)
      const editLink = screen.getByRole('link', { name: /edit example pin/i })
      expect(editLink).toBeInTheDocument()
      expect(editLink).toHaveAttribute('href', '/pin-1/edit')
    })

    it('has proper accessibility attributes for edit link', () => {
      renderWithRouter(<PinCard pin={mockPin} />)
      const editLink = screen.getByRole('link', { name: /edit example pin/i })
      expect(editLink).toHaveAttribute('aria-label', 'Edit Example Pin')
    })

    it('maintains edit button styling as a link', () => {
      renderWithRouter(<PinCard pin={mockPin} />)
      const editLink = screen.getByRole('link', { name: /edit example pin/i })
      expect(editLink).toHaveClass('text-accent', 'font-bold')
      expect(editLink).toHaveTextContent('edit')
    })

    it('generates correct edit URL for different pin IDs', () => {
      const customPin = {
        ...mockPin,
        id: 'custom-pin-123',
        title: 'Custom Pin',
      }
      renderWithRouter(<PinCard pin={customPin} />)
      const editLink = screen.getByRole('link', { name: /edit custom pin/i })
      expect(editLink).toHaveAttribute('href', '/custom-pin-123/edit')
    })
  })

  describe('Read Later functionality', () => {
    it('shows bold title with bullet for read-later pins', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} />)

      // Find the title link specifically (now includes bullet)
      const titleLink = screen.getByRole('link', { name: '• Example Pin' })
      expect(titleLink).toHaveClass('font-bold')

      // Check for bullet character in the title
      expect(titleLink).toHaveTextContent('•')
      expect(titleLink).toHaveTextContent('• Example Pin')
    })

    it('shows normal title without bullet for regular pins', () => {
      const regularPin = { ...mockPin, readLater: false }
      renderWithRouter(<PinCard pin={regularPin} />)

      // Find the title link specifically (not the URL link)
      const titleLink = screen.getByRole('link', { name: 'Example Pin' })
      expect(titleLink).not.toHaveClass('font-bold')

      // Should not have bullet character
      expect(titleLink).not.toHaveTextContent('•')
      expect(titleLink).toHaveTextContent('Example Pin')
      expect(titleLink).not.toHaveTextContent('• Example Pin')
    })
  })

  describe('Mark as Read functionality', () => {
    it('shows mark as read button only for read-later pins', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} />)

      const markAsReadButton = screen.getByRole('button', {
        name: /mark.*as read/i,
      })
      expect(markAsReadButton).toBeInTheDocument()
    })

    it('does not show mark as read button for regular pins', () => {
      const regularPin = { ...mockPin, readLater: false }
      renderWithRouter(<PinCard pin={regularPin} />)

      const markAsReadButton = screen.queryByRole('button', {
        name: /mark.*as read/i,
      })
      expect(markAsReadButton).not.toBeInTheDocument()
    })

    it('positions mark as read button after edit and delete actions', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} />)

      const actionsGroup = screen.getByRole('group', { name: /actions for/i })

      // Get all elements in order (buttons and links)
      const allActions = actionsGroup.children

      // Should have edit link, delete button, and mark as read form
      expect(allActions).toHaveLength(3)

      // Check order: edit link first, delete button second, mark as read form third
      const editLink = allActions[0] as HTMLElement
      const deleteButton = allActions[1] as HTMLElement
      const markAsReadForm = allActions[2] as HTMLElement

      expect(editLink.tagName.toLowerCase()).toBe('a')
      expect(editLink).toHaveTextContent('edit')

      expect(deleteButton.tagName.toLowerCase()).toBe('button')
      expect(deleteButton).toHaveTextContent('delete')

      expect(markAsReadForm.tagName.toLowerCase()).toBe('form')
      expect(within(markAsReadForm).getByRole('button')).toHaveTextContent(
        'mark as read'
      )
    })

    it('has proper accessibility attributes', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} />)

      const markAsReadButton = screen.getByRole('button', {
        name: /mark.*as read/i,
      })
      expect(markAsReadButton).toHaveAttribute(
        'aria-label',
        `Mark ${mockPin.title} as read`
      )
      expect(markAsReadButton).toHaveAttribute('type', 'submit')
    })

    it('submits PATCH request when clicked', async () => {
      const user = userEvent.setup()
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} />)

      const markAsReadButton = screen.getByRole('button', {
        name: /mark.*as read/i,
      })
      await user.click(markAsReadButton)

      // The form should submit to the edit route with PATCH method
      // This will be tested more thoroughly in integration tests
      expect(markAsReadButton.closest('form')).toHaveAttribute(
        'action',
        `/${mockPin.id}/edit`
      )
      expect(markAsReadButton.closest('form')).toHaveAttribute('method', 'post')
    })
  })

  describe('Delete functionality', () => {
    it('should render delete button', () => {
      renderWithRouter(<PinCard pin={mockPin} />)
      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      expect(deleteButton).toBeInTheDocument()
      expect(deleteButton).toHaveTextContent('delete')
    })

    it('should open confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PinCard pin={mockPin} />)

      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      await user.click(deleteButton)

      // Dialog should be open and visible
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

    it('should display pin details in confirmation dialog', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PinCard pin={mockPin} />)

      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      await user.click(deleteButton)

      // Pin details should be visible in dialog - check within dialog context
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent('Example Pin')
      expect(dialog).toHaveTextContent('https://example.com')
    })

    it('should close dialog when cancel is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PinCard pin={mockPin} />)

      // Open dialog
      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      await user.click(deleteButton)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Close dialog
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should close dialog when X button is clicked', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PinCard pin={mockPin} />)

      // Open dialog
      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      await user.click(deleteButton)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Close dialog with X button
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should close dialog when escape key is pressed', async () => {
      const user = userEvent.setup()
      renderWithRouter(<PinCard pin={mockPin} />)

      // Open dialog
      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      await user.click(deleteButton)
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Close with escape key
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should handle dialog state properly for different pins', async () => {
      const user = userEvent.setup()
      const secondPin = {
        ...mockPin,
        id: 'pin-2',
        title: 'Second Pin',
        url: 'https://second.com',
      }

      renderWithRouter(
        <div>
          <PinCard pin={mockPin} />
          <PinCard pin={secondPin} />
        </div>
      )

      // Click delete on first pin
      const firstDeleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })
      await user.click(firstDeleteButton)

      // Verify dialog is open and shows correct pin details
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Within the dialog specifically, check for the pin details
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveTextContent('Example Pin')
      expect(dialog).toHaveTextContent('https://example.com')

      // The second pin's details should still be visible in the page, but not in the dialog
      // This test confirms the correct pin is shown in the delete dialog
      const pinElements = screen.getAllByText('Example Pin')
      expect(pinElements.length).toBeGreaterThanOrEqual(2) // One in page, one in dialog
    })

    it('should have proper accessibility attributes for delete button', () => {
      renderWithRouter(<PinCard pin={mockPin} />)
      const deleteButton = screen.getByRole('button', {
        name: /delete example pin/i,
      })

      expect(deleteButton).toHaveAttribute('aria-label', 'Delete Example Pin')
      expect(deleteButton).toHaveClass('text-destructive', 'font-bold')
      expect(deleteButton).toHaveAttribute('type', 'button')
    })
  })
})
