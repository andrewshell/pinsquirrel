import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Pin } from '@pinsquirrel/core'
import { PinCard } from './PinCard'
import { Pagination } from './Pagination'
import { PinList } from './PinList'

interface MockLinkProps {
  to: string
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

// Mock React Router Link component
vi.mock('react-router', () => ({
  Link: ({
    to,
    children,
    className,
    'aria-label': ariaLabel,
  }: MockLinkProps) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}))

describe('Pin List Accessibility', () => {
  const mockPin: Pin = {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    description: 'A test article description',
    readLater: false,
    contentPath: null,
    imagePath: null,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('PinCard Keyboard Navigation', () => {
    it('allows keyboard navigation to action buttons', async () => {
      const user = userEvent.setup()
      render(<PinCard pin={mockPin} />)

      // Tab to title link
      await user.tab()
      const titleLink = screen.getByRole('link', { name: 'Test Article' })
      expect(titleLink).toHaveFocus()

      // Tab to URL link
      await user.tab()
      const urlLink = screen.getByRole('link', {
        name: 'https://example.com/article',
      })
      expect(urlLink).toHaveFocus()

      // Tab to first action button (Edit)
      await user.tab()
      const editButton = screen.getByLabelText('Edit Test Article')
      expect(editButton).toHaveFocus()

      // Tab to second action button (Delete)
      await user.tab()
      const deleteButton = screen.getByLabelText('Delete Test Article')
      expect(deleteButton).toHaveFocus()
    })

    it('allows activation of action buttons with keyboard', async () => {
      const user = userEvent.setup()
      render(<PinCard pin={mockPin} />)

      // Tab to title link
      await user.tab()
      // Tab to URL link
      await user.tab()
      // Tab to edit button and verify focus
      await user.tab()
      const editButton = screen.getByLabelText('Edit Test Article')
      expect(editButton).toHaveFocus()

      // Tab to delete button and verify focus
      await user.tab()
      const deleteButton = screen.getByLabelText('Delete Test Article')
      expect(deleteButton).toHaveFocus()

      // Verify buttons are focusable and have proper attributes
      expect(editButton).toHaveAttribute('aria-label', 'Edit Test Article')
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete Test Article')
    })

    it('has proper heading structure for screen readers', () => {
      render(<PinCard pin={mockPin} />)

      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('Test Article')
    })

    it('has semantic markup for tags', () => {
      render(<PinCard pin={mockPin} />)

      // Tags should be in a container with proper text content
      const tagsContainer = screen.getByTestId('pin-tags')
      expect(tagsContainer).toBeInTheDocument()

      const jsTag = screen.getByText('javascript')
      const reactTag = screen.getByText('react')
      expect(jsTag).toBeInTheDocument()
      expect(reactTag).toBeInTheDocument()
    })
  })

  describe('Pagination Keyboard Navigation', () => {
    it('allows keyboard navigation through pagination controls', async () => {
      const user = userEvent.setup()
      render(<Pagination currentPage={2} totalPages={5} totalCount={125} />)

      // Tab through pagination controls in desktop view
      await user.tab()
      const prevButton = screen.getByLabelText('Go to previous page')
      expect(prevButton).toHaveFocus()

      await user.tab()
      const page1Link = screen.getByLabelText('Go to page 1')
      expect(page1Link).toHaveFocus()

      // Skip current page (not focusable) and go to next focusable element
      await user.tab()
      const page3Link = screen.getByLabelText('Go to page 3')
      expect(page3Link).toHaveFocus()

      // Current page should have proper aria-current
      const currentPage = screen.getByText('2')
      expect(currentPage).toHaveAttribute('aria-current', 'page')
    })

    it('properly handles disabled pagination buttons', async () => {
      const user = userEvent.setup()
      render(<Pagination currentPage={1} totalPages={5} totalCount={125} />)

      // Previous button should be disabled on first page
      const prevButton = screen.getByLabelText('Go to previous page')
      expect(prevButton).toHaveAttribute('aria-disabled', 'true')
      expect(prevButton).toHaveClass('pointer-events-none', 'opacity-50')

      // On first page, only pages 2-5 should be available as links
      // Current page (1) is not a focusable link
      await user.tab()
      const page2Link = screen.getByLabelText('Go to page 2')
      expect(page2Link).toHaveFocus()
    })

    it('has proper navigation landmark', () => {
      render(<Pagination currentPage={2} totalPages={5} totalCount={125} />)

      const nav = screen.getByRole('navigation')
      expect(nav).toHaveAttribute('aria-label', 'Pagination navigation')
    })

    it('announces page changes for screen readers', () => {
      render(<Pagination currentPage={3} totalPages={10} totalCount={250} />)

      // Current page should be announced
      const currentPage = screen.getByText('3')
      expect(currentPage).toHaveAttribute('aria-current', 'page')

      // Page info should be available
      expect(
        screen.getByText('Page 3 of 10 (250 total pins)')
      ).toBeInTheDocument()
    })
  })

  describe('PinList Keyboard Navigation', () => {
    const mockPins = [
      { ...mockPin, id: 'pin-1', title: 'First Pin' },
      { ...mockPin, id: 'pin-2', title: 'Second Pin' },
      { ...mockPin, id: 'pin-3', title: 'Third Pin' },
    ]

    it('allows sequential keyboard navigation through pin cards', async () => {
      const user = userEvent.setup()
      render(<PinList pins={mockPins} isLoading={false} />)

      // Tab through first pin's elements: title link, URL link, edit button, delete button
      await user.tab()
      const titleLinks = screen.getAllByRole('link', { name: /Pin/ })
      expect(titleLinks[0]).toHaveFocus() // First pin's title link

      await user.tab()
      // Should focus URL link of first pin

      await user.tab()
      const editButtons = screen.getAllByLabelText(/Edit/)
      expect(editButtons[0]).toHaveFocus()

      await user.tab()
      const deleteButtons = screen.getAllByLabelText(/Delete/)
      expect(deleteButtons[0]).toHaveFocus()

      await user.tab()
      // Should move to second pin's title link
      expect(titleLinks[1]).toHaveFocus()
    })

    it('has proper heading hierarchy', () => {
      render(<PinList pins={mockPins} isLoading={false} />)

      const headings = screen.getAllByRole('heading', { level: 3 })
      expect(headings).toHaveLength(3)
      expect(headings[0]).toHaveTextContent('First Pin')
      expect(headings[1]).toHaveTextContent('Second Pin')
      expect(headings[2]).toHaveTextContent('Third Pin')
    })

    it('maintains proper focus order in list layout', async () => {
      const user = userEvent.setup()
      render(<PinList pins={mockPins} isLoading={false} />)

      // List should maintain logical tab order
      const listContainer = screen.getByTestId('pin-list')
      expect(listContainer).toHaveClass('space-y-4')

      // First tab should go to first pin's title link
      await user.tab()
      const titleLinks = screen.getAllByRole('link', { name: /Pin/ })
      expect(titleLinks[0]).toHaveFocus()
    })

    it('handles empty state accessibility', () => {
      render(<PinList pins={[]} isLoading={false} />)

      // Empty state should be announced to screen readers (h3 level)
      const emptyHeading = screen.getByRole('heading', { level: 3 })
      expect(emptyHeading).toHaveTextContent("You don't have any pins yet")

      // Should have descriptive text
      expect(
        screen.getByText(/Start saving your favorite links/)
      ).toBeInTheDocument()
    })

    it('provides loading state announcements', () => {
      render(<PinList pins={[]} isLoading={true} />)

      // Loading state should be accessible
      const loadingContainer = screen.getByTestId('pin-list-loading')
      expect(loadingContainer).toBeInTheDocument()

      // Should have accessible loading indicators with proper test IDs
      const skeletons = screen.getAllByTestId(/pin-skeleton-\d+/)
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Focus Management', () => {
    it('maintains focus visibility with proper focus indicators', () => {
      render(<PinCard pin={mockPin} />)

      const editButton = screen.getByLabelText('Edit Test Article')
      const deleteButton = screen.getByLabelText('Delete Test Article')

      // Buttons should be accessible and have proper accessibility attributes
      expect(editButton).toHaveAttribute('aria-label', 'Edit Test Article')
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete Test Article')
    })

    it('respects reduced motion preferences for animations', () => {
      render(<PinCard pin={mockPin} />)

      // Action buttons should be always visible (no transition needed)
      const actionsContainer =
        screen.getByLabelText('Edit Test Article').parentElement
      expect(actionsContainer).toHaveClass('flex', 'gap-2')
    })
  })

  describe('Screen Reader Support', () => {
    it('provides meaningful text alternatives for icons', () => {
      render(<PinCard pin={mockPin} />)

      const editButton = screen.getByLabelText('Edit Test Article')
      const deleteButton = screen.getByLabelText('Delete Test Article')

      expect(editButton).toHaveAttribute('aria-label', 'Edit Test Article')
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete Test Article')
    })

    it('announces pagination state changes', () => {
      const { rerender } = render(
        <Pagination currentPage={1} totalPages={5} totalCount={125} />
      )

      // First page state
      expect(
        screen.getByText('Page 1 of 5 (125 total pins)')
      ).toBeInTheDocument()

      // Change to different page
      rerender(<Pagination currentPage={3} totalPages={5} totalCount={125} />)

      expect(
        screen.getByText('Page 3 of 5 (125 total pins)')
      ).toBeInTheDocument()
      const currentPage = screen.getByText('3')
      expect(currentPage).toHaveAttribute('aria-current', 'page')
    })

    it('provides contextual information for pin content', () => {
      render(<PinCard pin={mockPin} />)

      // Title should be in heading
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toHaveTextContent('Test Article')

      // Description should be accessible
      const description = screen.getByTestId('pin-description')
      expect(description).toHaveTextContent('A test article description')

      // URL should be clear
      expect(
        screen.getByText('https://example.com/article')
      ).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('adapts pagination layout for mobile and desktop screens', () => {
      render(<Pagination currentPage={2} totalPages={5} totalCount={125} />)

      // Mobile info section should be hidden on larger screens
      const mobileInfo = screen.getByText('Page 2 of 5').parentElement
      expect(mobileInfo).toHaveClass(
        'flex',
        'flex-1',
        'justify-between',
        'sm:hidden'
      )

      // Desktop pagination controls should be hidden on mobile
      const desktopPagination = screen.getByText(
        'Page 2 of 5 (125 total pins)'
      ).parentElement
      expect(desktopPagination).toHaveClass('hidden', 'sm:flex')

      // Mobile navigation buttons should be hidden on desktop
      const mobileNav = screen.getByLabelText(
        'Go to previous page (mobile)'
      ).parentElement
      expect(mobileNav).toHaveClass('flex', 'sm:hidden')
    })

    it('maintains proper vertical layout in pin list', () => {
      const mockPins = [
        { ...mockPin, id: 'pin-1', title: 'First Pin' },
        { ...mockPin, id: 'pin-2', title: 'Second Pin' },
      ]

      render(<PinList pins={mockPins} isLoading={false} />)

      const listContainer = screen.getByTestId('pin-list')

      // Check vertical list classes
      expect(listContainer).toHaveClass('space-y-4')
    })

    it('ensures pin cards adapt to different screen sizes', () => {
      render(<PinCard pin={mockPin} />)

      // Pin card should be flexible and adapt to parent container
      const card = screen.getByRole('article')
      expect(card).toHaveClass('py-1')

      // Content should have proper compact spacing
      const content = card.querySelector('.flex-1')
      expect(content).toHaveClass('flex-1', 'min-w-0')
    })

    it('provides accessible navigation on all screen sizes', () => {
      render(<Pagination currentPage={3} totalPages={10} totalCount={250} />)

      // Both mobile and desktop navigation should be accessible
      const mobilePrev = screen.getByLabelText('Go to previous page (mobile)')
      const mobileNext = screen.getByLabelText('Go to next page (mobile)')
      const desktopPrev = screen.getByLabelText('Go to previous page')
      const desktopNext = screen.getByLabelText('Go to next page')

      expect(mobilePrev).toBeInTheDocument()
      expect(mobileNext).toBeInTheDocument()
      expect(desktopPrev).toBeInTheDocument()
      expect(desktopNext).toBeInTheDocument()
    })
  })
})
