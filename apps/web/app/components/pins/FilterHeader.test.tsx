import { render, screen } from '@testing-library/react'
import { createRoutesStub } from 'react-router'
import { describe, it, expect } from 'vitest'
import { FilterHeader } from './FilterHeader'

describe('FilterHeader', () => {
  const createStub = (component: React.ReactElement) => {
    return createRoutesStub([
      {
        path: '/',
        Component: () => component,
      },
    ])
  }

  const renderWithRouter = (
    component: React.ReactElement,
    initialEntries: string[] = ['/']
  ) => {
    const Stub = createStub(component)
    return render(<Stub initialEntries={initialEntries} />)
  }

  it('should render tag filter with tag icon and result count', () => {
    renderWithRouter(<FilterHeader activeTag="react" />)

    expect(screen.getByText('FILTERS')).toBeInTheDocument()
    expect(screen.getByText('react')).toBeInTheDocument()

    // Check for tag icon
    const tagIcon = document.querySelector('.lucide-tag')
    expect(tagIcon).toBeInTheDocument()
  })

  it('should render search filter with search icon and result count', () => {
    renderWithRouter(
      <FilterHeader searchQuery="react tutorial" />
    )

    expect(screen.getByText('FILTERS')).toBeInTheDocument()
    expect(screen.getByText('"react tutorial"')).toBeInTheDocument()

    // Check for search icon
    const searchIcon = document.querySelector('.lucide-search')
    expect(searchIcon).toBeInTheDocument()
  })

  it('should render both tag and search filters together', () => {
    renderWithRouter(
      <FilterHeader
        activeTag="javascript"
        searchQuery="tutorial"
             />
    )

    expect(screen.getByText('javascript')).toBeInTheDocument()
    expect(screen.getByText('"tutorial"')).toBeInTheDocument()

    // Check for both icons
    const tagIcon = document.querySelector('.lucide-tag')
    const searchIcon = document.querySelector('.lucide-search')
    expect(tagIcon).toBeInTheDocument()
    expect(searchIcon).toBeInTheDocument()
  })

  it('should render tag filter correctly', () => {
    renderWithRouter(<FilterHeader activeTag="test" />)

    expect(screen.getByText('FILTERS')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()

    // Check for tag icon
    const tagIcon = document.querySelector('.lucide-tag')
    expect(tagIcon).toBeInTheDocument()
  })

  it('should render remove tag button with correct link', () => {
    renderWithRouter(<FilterHeader activeTag="react" />)

    const removeButton = screen.getByRole('button', {
      name: /remove react tag filter/i,
    })
    expect(removeButton).toBeInTheDocument()

    const removeLink = screen.getByRole('link')
    expect(removeLink).toHaveAttribute('href', '/')
  })

  it('should render clear search button with correct link', () => {
    renderWithRouter(<FilterHeader searchQuery="test query" />)

    const clearButton = screen.getByRole('button', { name: /clear search/i })
    expect(clearButton).toBeInTheDocument()

    const clearLink = screen.getByRole('link')
    expect(clearLink).toHaveAttribute('href', '/')
  })

  it('should preserve other URL parameters when removing tag filter', () => {
    const Stub = createRoutesStub([
      {
        path: '/user/pins',
        Component: () => <FilterHeader activeTag="articles" />,
      },
    ])

    render(<Stub initialEntries={['/user/pins?tag=articles&search=test']} />)

    const removeLink = screen.getByRole('link')
    expect(removeLink).toHaveAttribute('href', '/user/pins?search=test')
  })

  it('should preserve other URL parameters when clearing search', () => {
    const Stub = createRoutesStub([
      {
        path: '/user/pins',
        Component: () => (
          <FilterHeader searchQuery="test query" />
        ),
      },
    ])

    render(
      <Stub initialEntries={['/user/pins?search=test+query&tag=articles']} />
    )

    const clearLink = screen.getByRole('link')
    expect(clearLink).toHaveAttribute('href', '/user/pins?tag=articles')
  })

  it('should display X icons for remove buttons', () => {
    const { container } = renderWithRouter(
      <FilterHeader activeTag="react" searchQuery="tutorial" />
    )

    // Check for X icons SVG (should have 2 - one for tag, one for search)
    const xIcons = container.querySelectorAll('.lucide-x')
    expect(xIcons).toHaveLength(2)
  })

  it('should always render filter header with read status filter', () => {
    renderWithRouter(<FilterHeader />)

    // Should show FILTERS label
    expect(screen.queryByText('FILTERS')).toBeInTheDocument()
    // Should show "All Pins" as default read filter
    expect(screen.queryByText('All Pins')).toBeInTheDocument()
  })

  it('should show read filter even when tag is empty string', () => {
    renderWithRouter(<FilterHeader activeTag="" />)

    expect(screen.queryByText('FILTERS')).toBeInTheDocument()
    expect(screen.queryByText('All Pins')).toBeInTheDocument()
  })

  it('should show read filter even when search query is empty', () => {
    renderWithRouter(<FilterHeader searchQuery="" />)

    expect(screen.queryByText('FILTERS')).toBeInTheDocument()
    expect(screen.queryByText('All Pins')).toBeInTheDocument()
  })

  it('should show read filter even when search query is only whitespace', () => {
    renderWithRouter(<FilterHeader searchQuery="   " />)

    expect(screen.queryByText('FILTERS')).toBeInTheDocument()
    expect(screen.queryByText('All Pins')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = renderWithRouter(
      <FilterHeader activeTag="test" className="custom-class" />
    )

    const header = container.querySelector('.custom-class')
    expect(header).toBeInTheDocument()
  })

  it('should escape HTML in search query', () => {
    renderWithRouter(
      <FilterHeader
        searchQuery="<script>alert('xss')</script>"
             />
    )

    expect(
      screen.getByText('"<script>alert(\'xss\')</script>"')
    ).toBeInTheDocument()
  })

  it('should render with both filters and handle separate removal', () => {
    const Stub = createRoutesStub([
      {
        path: '/user/pins',
        Component: () => (
          <FilterHeader activeTag="react" searchQuery="hooks" />
        ),
      },
    ])

    render(
      <Stub initialEntries={['/user/pins?tag=react&search=hooks&page=2']} />
    )

    // Should have both filters displayed
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('"hooks"')).toBeInTheDocument()

    // Check both remove links preserve other parameters
    const removeLinks = screen.getAllByRole('link')
    const tagRemoveLink = removeLinks.find(
      link => link.getAttribute('href') === '/user/pins?search=hooks&page=2'
    )
    const searchRemoveLink = removeLinks.find(
      link => link.getAttribute('href') === '/user/pins?tag=react&page=2'
    )

    expect(tagRemoveLink).toBeTruthy()
    expect(searchRemoveLink).toBeTruthy()
  })
})
