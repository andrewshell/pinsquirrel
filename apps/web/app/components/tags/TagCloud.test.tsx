import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import { TagCloud } from './TagCloud'
import type { TagWithCount } from '@pinsquirrel/core'

const mockTags: TagWithCount[] = [
  {
    id: '1',
    userId: 'user1',
    name: 'typescript',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    pinCount: 25,
  },
  {
    id: '2',
    userId: 'user1',
    name: 'react',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    pinCount: 15,
  },
  {
    id: '3',
    userId: 'user1',
    name: 'javascript',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    pinCount: 5,
  },
  {
    id: '4',
    userId: 'user1',
    name: 'css',
    createdAt: new Date('2024-01-04'),
    updatedAt: new Date('2024-01-04'),
    pinCount: 1,
  },
]

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('TagCloud', () => {
  it('renders nothing when no tags provided', () => {
    const { container } = renderWithRouter(
      <TagCloud tags={[]} username="testuser" />
    )
    expect(container.firstChild).toBeNull()
  })

  it('displays all tags as clickable links', () => {
    renderWithRouter(<TagCloud tags={mockTags} username="testuser" />)

    mockTags.forEach(tag => {
      const link = screen.getByRole('link', { name: new RegExp(tag.name) })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute(
        'href',
        `/testuser/pins?tag=${encodeURIComponent(tag.name)}`
      )
    })
  })

  it('sorts tags alphabetically', () => {
    renderWithRouter(<TagCloud tags={mockTags} username="testuser" />)

    const links = screen.getAllByRole('link')
    const linkTexts = links.map(link => link.textContent)

    expect(linkTexts).toEqual(['css', 'javascript', 'react', 'typescript'])
  })

  it('applies different font sizes based on pin count', () => {
    renderWithRouter(<TagCloud tags={mockTags} username="testuser" />)

    const typescriptLink = screen.getByRole('link', { name: /typescript/ })
    const cssLink = screen.getByRole('link', { name: /css/ })

    // TypeScript has the most pins (25), should have larger font size
    expect(typescriptLink.className).toMatch(/text-(2xl|3xl)/)

    // CSS has the least pins (1), should have smaller font size
    expect(cssLink.className).toMatch(/text-(xs|sm|base)/)
  })

  it('includes pin count in title attribute', () => {
    renderWithRouter(<TagCloud tags={mockTags} username="testuser" />)

    const typescriptLink = screen.getByRole('link', { name: /typescript/ })
    expect(typescriptLink).toHaveAttribute('title', 'typescript (25 pins)')

    const cssLink = screen.getByRole('link', { name: /css/ })
    expect(cssLink).toHaveAttribute('title', 'css (1 pin)')
  })

  it('handles single tag correctly', () => {
    const singleTag: TagWithCount[] = [mockTags[0]]
    renderWithRouter(<TagCloud tags={singleTag} username="testuser" />)

    const link = screen.getByRole('link', { name: /typescript/ })
    expect(link).toBeInTheDocument()
    // Single tag should get medium size since there's no distribution
    expect(link.className).toMatch(/text-lg/)
  })

  it('handles tags with same pin count', () => {
    const samePinCountTags: TagWithCount[] = [
      { ...mockTags[0], pinCount: 10 },
      { ...mockTags[1], pinCount: 10 },
      { ...mockTags[2], pinCount: 10 },
    ]

    renderWithRouter(<TagCloud tags={samePinCountTags} username="testuser" />)

    const links = screen.getAllByRole('link')
    links.forEach(link => {
      // All tags should have the same font size when counts are equal
      expect(link.className).toMatch(/text-lg/)
    })
  })

  it('encodes tag names properly in URLs', () => {
    const specialTags: TagWithCount[] = [
      {
        id: '1',
        userId: 'user1',
        name: 'C++',
        createdAt: new Date(),
        updatedAt: new Date(),
        pinCount: 5,
      },
    ]

    renderWithRouter(<TagCloud tags={specialTags} username="testuser" />)

    const link = screen.getByRole('link', { name: /C\+\+/ })
    expect(link).toHaveAttribute('href', '/testuser/pins?tag=C%2B%2B')
  })
})
