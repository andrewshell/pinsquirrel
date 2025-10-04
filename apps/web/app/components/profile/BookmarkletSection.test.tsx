import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BookmarkletSection } from './BookmarkletSection'

describe('BookmarkletSection', () => {
  it('renders bookmarklet section with title', () => {
    render(<BookmarkletSection />)

    expect(screen.getByText('Quick Pin Bookmarklet')).toBeInTheDocument()
  })

  it('displays installation instructions', () => {
    render(<BookmarkletSection />)

    expect(
      screen.getByText(/drag the bookmarklet below to your bookmarks bar/i)
    ).toBeInTheDocument()
  })

  it('renders bookmarklet link with correct href structure', () => {
    render(<BookmarkletSection />)

    const bookmarkletLink = screen.getByText('📌 Pin to PinSquirrel')
    expect(bookmarkletLink).toBeInTheDocument()

    // After useEffect runs, the href should be set via setAttribute
    // In test environment, we check that the href is set correctly
    const href = bookmarkletLink.getAttribute('href')
    expect(href).toMatch(/^javascript:/)
  })

  it('displays usage instructions for the bookmarklet', () => {
    render(<BookmarkletSection />)

    expect(
      screen.getByText(/click the bookmarklet while on any webpage/i)
    ).toBeInTheDocument()
  })

  it('explains selected text behavior', () => {
    render(<BookmarkletSection />)

    expect(
      screen.getByText(/if you have text selected.*description/i)
    ).toBeInTheDocument()
  })

  it('shows drag instruction', () => {
    render(<BookmarkletSection />)

    expect(
      screen.getByText(/drag this to your bookmarks bar/i)
    ).toBeInTheDocument()
  })

  it('shows tip about selected text conversion', () => {
    render(<BookmarkletSection />)

    expect(
      screen.getByText(/select text on a webpage before clicking/i)
    ).toBeInTheDocument()
  })

  it('has draggable bookmarklet link', () => {
    render(<BookmarkletSection />)

    const bookmarkletLink = screen.getByText('📌 Pin to PinSquirrel')
    expect(bookmarkletLink.getAttribute('draggable')).toBe('true')
  })

  it('has proper styling classes for bookmarklet button', () => {
    render(<BookmarkletSection />)

    const bookmarkletLink = screen.getByText('📌 Pin to PinSquirrel')
    expect(bookmarkletLink.className).toContain('cursor-move')
    expect(bookmarkletLink.className).toContain('select-none')
  })

  it('shows numbered instruction list', () => {
    render(<BookmarkletSection />)

    expect(
      screen.getByText(/drag the bookmarklet above to your browser/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/navigate to any webpage you want to pin/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/click the bookmarklet while on any webpage/i)
    ).toBeInTheDocument()
  })
})
