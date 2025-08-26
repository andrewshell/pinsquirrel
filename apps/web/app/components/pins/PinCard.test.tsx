import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PinCard } from './PinCard'
import type { Pin } from '@pinsquirrel/domain'

// Helper function to render with router context
const renderWithRouter = (component: React.ReactNode, initialPath = '/') => {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: component,
      },
      {
        path: '/:username/pins',
        element: <div>Pins Route</div>,
      },
      {
        path: '/:username/pins/:id/edit',
        action: ({ request }) => {
          if (request.method === 'PATCH') {
            // Mock successful PATCH response for readLater toggle
            return new Response(
              JSON.stringify({ success: true, readLater: true }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          }
          return null
        },
        element: <div>Edit Route</div>,
      },
    ],
    {
      initialEntries: [initialPath],
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
    renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
    expect(screen.getByText('Example Pin')).toBeInTheDocument()
  })

  it('displays full URL', () => {
    renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
  })

  it('displays description when present', () => {
    renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
    const description = screen.getByTestId('pin-description')
    expect(description).toHaveTextContent('This is a test pin description')
  })

  it('shows all associated tags as badges', () => {
    renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()
  })

  it('hides description when not provided', () => {
    const pinWithoutDesc = { ...mockPin, description: null }
    renderWithRouter(<PinCard pin={pinWithoutDesc} username="testuser" />)
    expect(screen.queryByTestId('pin-description')).not.toBeInTheDocument()
  })

  it('renders action buttons appropriately', () => {
    renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
    expect(screen.getByLabelText('Edit Example Pin')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Example Pin')).toBeInTheDocument()
  })

  it('handles pins with no tags', () => {
    const pinWithoutTags = { ...mockPin, tags: [] }
    renderWithRouter(<PinCard pin={pinWithoutTags} username="testuser" />)
    expect(screen.queryByTestId('pin-tags')).not.toBeInTheDocument()
  })

  it('handles invalid URLs gracefully', () => {
    const pinWithInvalidUrl = { ...mockPin, url: 'not-a-valid-url' }
    renderWithRouter(<PinCard pin={pinWithInvalidUrl} username="testuser" />)
    expect(screen.getByText('not-a-valid-url')).toBeInTheDocument()
  })

  it('displays full URL including www and path', () => {
    const pinWithWww = { ...mockPin, url: 'https://www.example.com/path' }
    renderWithRouter(<PinCard pin={pinWithWww} username="testuser" />)
    expect(screen.getByText('https://www.example.com/path')).toBeInTheDocument()
  })

  it('handles empty description with null value', () => {
    const pinWithNullDesc = { ...mockPin, description: null }
    renderWithRouter(<PinCard pin={pinWithNullDesc} username="testuser" />)
    expect(screen.queryByTestId('pin-description')).not.toBeInTheDocument()
  })

  it('renders action buttons as text links with proper accessibility', () => {
    renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
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

    renderWithRouter(<PinCard pin={pinWithOldDate} username="testuser" />)
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
  })

  describe('Edit button', () => {
    it('renders edit button as a link to edit route', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
      const editLink = screen.getByRole('link', { name: /edit example pin/i })
      expect(editLink).toBeInTheDocument()
      expect(editLink).toHaveAttribute('href', '/testuser/pins/pin-1/edit')
    })

    it('has proper accessibility attributes for edit link', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
      const editLink = screen.getByRole('link', { name: /edit example pin/i })
      expect(editLink).toHaveAttribute('aria-label', 'Edit Example Pin')
    })

    it('maintains edit button styling as a link', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
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
      renderWithRouter(<PinCard pin={customPin} username="testuser" />)
      const editLink = screen.getByRole('link', { name: /edit custom pin/i })
      expect(editLink).toHaveAttribute(
        'href',
        '/testuser/pins/custom-pin-123/edit'
      )
    })
  })

  describe('Read Later functionality', () => {
    it('shows bold title with bullet for read-later pins', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} username="testuser" />)

      // Find the title link specifically (now includes bullet)
      const titleLink = screen.getByRole('link', { name: '• Example Pin' })
      expect(titleLink).toHaveClass('font-bold')

      // Check for bullet character in the title
      expect(titleLink).toHaveTextContent('•')
      expect(titleLink).toHaveTextContent('• Example Pin')
    })

    it('shows normal title without bullet for regular pins', () => {
      const regularPin = { ...mockPin, readLater: false }
      renderWithRouter(<PinCard pin={regularPin} username="testuser" />)

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
      renderWithRouter(<PinCard pin={readLaterPin} username="testuser" />)

      const markAsReadButton = screen.getByRole('button', {
        name: /mark.*as read/i,
      })
      expect(markAsReadButton).toBeInTheDocument()
    })

    it('does not show mark as read button for regular pins', () => {
      const regularPin = { ...mockPin, readLater: false }
      renderWithRouter(<PinCard pin={regularPin} username="testuser" />)

      const markAsReadButton = screen.queryByRole('button', {
        name: /mark.*as read/i,
      })
      expect(markAsReadButton).not.toBeInTheDocument()
    })

    it('positions mark as read button after edit and delete actions', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} username="testuser" />)

      const actionsGroup = screen.getByRole('group', { name: /actions for/i })

      // Get all elements in order (buttons and links)
      const allActions = actionsGroup.children

      // Should have edit link, delete link, and mark as read form
      expect(allActions).toHaveLength(3)

      // Check order: edit link first, delete link second, mark as read form third
      const editLink = allActions[0] as HTMLElement
      const deleteLink = allActions[1] as HTMLElement
      const markAsReadForm = allActions[2] as HTMLElement

      expect(editLink.tagName.toLowerCase()).toBe('a')
      expect(editLink).toHaveTextContent('edit')

      expect(deleteLink.tagName.toLowerCase()).toBe('a')
      expect(deleteLink).toHaveTextContent('delete')

      expect(markAsReadForm.tagName.toLowerCase()).toBe('form')
      expect(within(markAsReadForm).getByRole('button')).toHaveTextContent(
        'mark as read'
      )
    })

    it('has proper accessibility attributes', () => {
      const readLaterPin = { ...mockPin, readLater: true }
      renderWithRouter(<PinCard pin={readLaterPin} username="testuser" />)

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
      renderWithRouter(<PinCard pin={readLaterPin} username="testuser" />)

      const markAsReadButton = screen.getByRole('button', {
        name: /mark.*as read/i,
      })
      await user.click(markAsReadButton)

      // The form should submit to the edit route with PATCH method
      // This will be tested more thoroughly in integration tests
      expect(markAsReadButton.closest('form')).toHaveAttribute(
        'action',
        `/testuser/pins/${mockPin.id}/edit`
      )
      expect(markAsReadButton.closest('form')).toHaveAttribute('method', 'post')
    })
  })

  describe('Delete functionality', () => {
    it('should render delete link', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
      const deleteLink = screen.getByRole('link', {
        name: /delete example pin/i,
      })
      expect(deleteLink).toBeInTheDocument()
      expect(deleteLink).toHaveTextContent('delete')
    })

    it('should have correct delete link href', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      const deleteLink = screen.getByRole('link', {
        name: /delete example pin/i,
      })
      expect(deleteLink).toHaveAttribute('href', '/testuser/pins/pin-1/delete')
    })

    it('should not render confirmation dialog in component', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      // Dialog should not be rendered in the component anymore (it's now a route)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(
        screen.queryByText('Are you sure you want to delete this pin?')
      ).not.toBeInTheDocument()
    })

    it('should have proper CSS classes for delete link', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      const deleteLink = screen.getByRole('link', {
        name: /delete example pin/i,
      })
      expect(deleteLink).toHaveClass(
        'text-destructive',
        'hover:text-destructive/80',
        'font-bold',
        'hover:underline'
      )
    })

    it('should generate correct delete URL for different pins', () => {
      const differentPin = {
        ...mockPin,
        id: 'different-pin-id',
        title: 'Different Pin',
      }
      renderWithRouter(<PinCard pin={differentPin} username="testuser" />)

      const deleteLink = screen.getByRole('link', {
        name: /delete different pin/i,
      })
      expect(deleteLink).toHaveAttribute(
        'href',
        '/testuser/pins/different-pin-id/delete'
      )
    })

    it('should not have dialog component state management', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      // Since delete is now a route, the component should not manage dialog state
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render separate delete links for different pins', () => {
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

      // Verify each pin has its own delete link with correct href
      const firstDeleteLink = screen.getByRole('link', {
        name: /delete example pin/i,
      })
      const secondDeleteLink = screen.getByRole('link', {
        name: /delete second pin/i,
      })

      expect(firstDeleteLink).toHaveAttribute('href', '/pin-1/delete')
      expect(secondDeleteLink).toHaveAttribute('href', '/pin-2/delete')
    })

    it('should have proper accessibility attributes for delete link', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)
      const deleteLink = screen.getByRole('link', {
        name: /delete example pin/i,
      })

      expect(deleteLink).toHaveAttribute('aria-label', 'Delete Example Pin')
      expect(deleteLink).toHaveClass('text-destructive', 'font-bold')
    })
  })

  describe('Tag links functionality', () => {
    it('renders tag names as clickable links', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })
      const reactTag = screen.getByRole('link', {
        name: /filter by tag: react/i,
      })

      expect(javascriptTag).toBeInTheDocument()
      expect(reactTag).toBeInTheDocument()
      expect(javascriptTag).toHaveTextContent('javascript')
      expect(reactTag).toHaveTextContent('react')
    })

    it('generates correct tag filter URLs', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })
      const reactTag = screen.getByRole('link', {
        name: /filter by tag: react/i,
      })

      expect(javascriptTag).toHaveAttribute(
        'href',
        '/testuser/pins?tag=javascript'
      )
      expect(reactTag).toHaveAttribute('href', '/testuser/pins?tag=react')
    })

    it('preserves existing unread filter when clicking tags', () => {
      // Render with an unread filter in the URL
      renderWithRouter(
        <PinCard pin={mockPin} username="testuser" />,
        '/?unread=true'
      )

      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })
      const reactTag = screen.getByRole('link', {
        name: /filter by tag: react/i,
      })

      expect(javascriptTag).toHaveAttribute(
        'href',
        '/testuser/pins?unread=true&tag=javascript'
      )
      expect(reactTag).toHaveAttribute(
        'href',
        '/testuser/pins?unread=true&tag=react'
      )
    })

    it('preserves other query parameters when clicking tags', () => {
      // Render with existing query parameters
      renderWithRouter(
        <PinCard pin={mockPin} username="testuser" />,
        '/?unread=false&page=2'
      )

      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })

      expect(javascriptTag).toHaveAttribute(
        'href',
        '/testuser/pins?unread=false&page=2&tag=javascript'
      )
    })

    it('has proper accessibility attributes for tag links', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })

      expect(javascriptTag).toHaveAttribute(
        'aria-label',
        'Filter by tag: javascript'
      )
      expect(javascriptTag).toHaveClass(
        'text-accent',
        'hover:text-accent/80',
        'hover:underline'
      )
    })

    it('handles pins without username parameter', () => {
      renderWithRouter(<PinCard pin={mockPin} />)

      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })

      // Without username, should use relative URL (React Router will add leading slash)
      expect(javascriptTag).toHaveAttribute('href', '/?tag=javascript')
    })

    it('separates tags with commas correctly', () => {
      renderWithRouter(<PinCard pin={mockPin} username="testuser" />)

      const tagsContainer = screen.getByTestId('pin-tags')

      // Should contain both tags and a comma separator
      expect(tagsContainer).toHaveTextContent('javascript, react')

      // Verify the comma is not part of the link
      const javascriptTag = screen.getByRole('link', {
        name: /filter by tag: javascript/i,
      })
      const reactTag = screen.getByRole('link', {
        name: /filter by tag: react/i,
      })

      expect(javascriptTag).toHaveTextContent('javascript')
      expect(javascriptTag).not.toHaveTextContent(',')
      expect(reactTag).toHaveTextContent('react')
      expect(reactTag).not.toHaveTextContent(',')
    })
  })
})
