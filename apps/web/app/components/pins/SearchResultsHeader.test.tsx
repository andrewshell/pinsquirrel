import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, it, expect } from 'vitest'
import { SearchResultsHeader } from './SearchResultsHeader'

describe('SearchResultsHeader', () => {
  const createStub = (component: React.ReactElement) => {
    return createRoutesStub([
      {
        path: '/',
        Component: () => component,
      },
    ])
  }

  const renderWithRouter = (component: React.ReactElement) => {
    const Stub = createStub(component)
    return render(<Stub initialEntries={['/']} />)
  }

  it('should render search results header with query and count', () => {
    renderWithRouter(
      <SearchResultsHeader searchQuery="react tutorial" resultCount={5} />
    )

    expect(screen.getByText('SEARCH')).toBeInTheDocument()
    expect(screen.getByText('"react tutorial"')).toBeInTheDocument()
    expect(screen.getByText('5 pins found')).toBeInTheDocument()
  })

  it('should handle singular vs plural pin count correctly', () => {
    const { rerender } = renderWithRouter(
      <SearchResultsHeader searchQuery="test" resultCount={1} />
    )

    expect(screen.getByText('1 pin found')).toBeInTheDocument()

    const Stub2 = createStub(
      <SearchResultsHeader searchQuery="test" resultCount={0} />
    )
    rerender(<Stub2 initialEntries={['/']} />)

    expect(screen.getByText('No pins found')).toBeInTheDocument()
  })

  it('should render clear search button with correct link', () => {
    renderWithRouter(
      <SearchResultsHeader searchQuery="test query" resultCount={3} />
    )

    const clearButton = screen.getByRole('button', { name: /clear search/i })
    expect(clearButton).toBeInTheDocument()

    const clearLink = screen.getByRole('link')
    expect(clearLink).toHaveAttribute('href', '/')
  })

  it('should preserve other URL parameters when clearing search', () => {
    const Stub = createRoutesStub([
      {
        path: '/user/pins',
        Component: () => (
          <SearchResultsHeader searchQuery="test query" resultCount={3} />
        ),
      },
    ])

    render(
      <Stub initialEntries={['/user/pins?search=test+query&tag=articles']} />
    )

    const clearLink = screen.getByRole('link')
    expect(clearLink).toHaveAttribute('href', '/user/pins?tag=articles')
  })

  it('should display X icon for clear button', () => {
    const { container } = renderWithRouter(
      <SearchResultsHeader searchQuery="test" resultCount={2} />
    )

    // Check for X icon SVG
    const xIcon = container.querySelector('svg')
    expect(xIcon).toBeInTheDocument()
    expect(xIcon).toHaveClass('lucide-x')
  })

  it('should not render when search query is empty', () => {
    renderWithRouter(<SearchResultsHeader searchQuery="" resultCount={0} />)

    expect(screen.queryByText('SEARCH')).not.toBeInTheDocument()
  })

  it('should not render when search query is only whitespace', () => {
    renderWithRouter(<SearchResultsHeader searchQuery="   " resultCount={0} />)

    expect(screen.queryByText('SEARCH')).not.toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = renderWithRouter(
      <SearchResultsHeader
        searchQuery="test"
        resultCount={1}
        className="custom-class"
      />
    )

    const header = container.querySelector('.custom-class')
    expect(header).toBeInTheDocument()
  })

  it('should escape HTML in search query', () => {
    renderWithRouter(
      <SearchResultsHeader
        searchQuery="<script>alert('xss')</script>"
        resultCount={0}
      />
    )

    expect(
      screen.getByText('"<script>alert(\'xss\')</script>"')
    ).toBeInTheDocument()
  })
})
