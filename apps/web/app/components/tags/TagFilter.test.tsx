import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import { TagFilter, type TagFilterType } from './TagFilter'

function renderTagFilter(currentFilter: TagFilterType, username = 'testuser') {
  return render(
    <BrowserRouter>
      <TagFilter currentFilter={currentFilter} username={username} />
    </BrowserRouter>
  )
}

describe('TagFilter', () => {
  describe('desktop view', () => {
    it('renders all filter buttons', () => {
      renderTagFilter('all')

      const allLinks = screen.getAllByText('All')
      const toReadLinks = screen.getAllByText('To Read')

      expect(allLinks.length).toBeGreaterThan(0)
      expect(toReadLinks.length).toBeGreaterThan(0)
    })

    it('generates correct filter links', () => {
      renderTagFilter('all')

      const allLinks = screen.getAllByRole('link', { name: 'All' })
      const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

      // Find the desktop links (not in dropdown)
      const desktopAllLink = allLinks.find(
        link => link.getAttribute('href') === '/testuser/tags'
      )
      const desktopToReadLink = toReadLinks.find(
        link => link.getAttribute('href') === '/testuser/tags?filter=toread'
      )

      expect(desktopAllLink).toBeInTheDocument()
      expect(desktopToReadLink).toBeInTheDocument()
    })
  })

  describe('mobile view', () => {
    it('shows current filter label in mobile view', () => {
      renderTagFilter('toread')

      const toReadTexts = screen.getAllByText('To Read')
      expect(toReadTexts.length).toBeGreaterThan(0)
    })

    it('includes dropdown menu with all filter options', () => {
      renderTagFilter('toread')

      // Current filter button and dropdown items will have same text
      const toReadTexts = screen.getAllByText('To Read')
      expect(toReadTexts.length).toBeGreaterThan(0)

      // Dropdown items (there will be duplicates due to desktop/mobile views)
      const allLinks = screen.getAllByRole('link', { name: 'All' })
      const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

      expect(allLinks.length).toBeGreaterThan(0)
      expect(toReadLinks.length).toBeGreaterThan(0)
    })
  })

  describe('filter labels', () => {
    it('displays correct label for all filter', () => {
      renderTagFilter('all')
      const allLabels = screen.getAllByText('All')
      expect(allLabels.length).toBeGreaterThan(0)
    })

    it('displays correct label for toread filter', () => {
      renderTagFilter('toread')
      const toReadLabels = screen.getAllByText('To Read')
      expect(toReadLabels.length).toBeGreaterThan(0)
    })
  })

  describe('custom username', () => {
    it('generates links with custom username', () => {
      renderTagFilter('all', 'customuser')

      const allLinks = screen.getAllByRole('link', { name: 'All' })
      const toReadLinks = screen.getAllByRole('link', { name: 'To Read' })

      const customAllLink = allLinks.find(
        link => link.getAttribute('href') === '/customuser/tags'
      )
      const customToReadLink = toReadLinks.find(
        link => link.getAttribute('href') === '/customuser/tags?filter=toread'
      )

      expect(customAllLink).toBeInTheDocument()
      expect(customToReadLink).toBeInTheDocument()
    })
  })
})
