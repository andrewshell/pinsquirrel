import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SearchInput } from './SearchInput'

describe('SearchInput', () => {
  const mockOnSearch = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnSearch.mockClear()
    mockOnClose.mockClear()
  })

  it('should render input field when visible', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    expect(input).toBeInTheDocument()
  })

  it('should not render input field when not visible', () => {
    render(
      <SearchInput
        isVisible={false}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.queryByRole('textbox', { name: /search pins/i })
    expect(input).not.toBeInTheDocument()
  })

  it('should auto-focus input when revealed', async () => {
    const { rerender } = render(
      <SearchInput
        isVisible={false}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    rerender(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /search pins/i })
      expect(input).toHaveFocus()
    })
  })

  it('should display initial value in input', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue="test query"
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    expect(input).toHaveValue('test query')
  })

  it('should call onSearch when Enter key is pressed', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    fireEvent.change(input, { target: { value: 'search term' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockOnSearch).toHaveBeenCalledWith('search term')
  })

  it('should call onClose when Escape key is pressed', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onSearch when search button is clicked', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    fireEvent.change(input, { target: { value: 'search term' } })

    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)

    expect(mockOnSearch).toHaveBeenCalledWith('search term')
  })

  it('should update input value on change', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    fireEvent.change(input, { target: { value: 'new value' } })

    expect(input).toHaveValue('new value')
  })

  it('should have correct accessibility attributes', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    expect(input).toHaveAttribute('placeholder', 'Search pins...')
    expect(input).toHaveAttribute('aria-label', 'Search pins')
  })

  it('should render search button with correct icon', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const searchButton = screen.getByRole('button', { name: /search/i })
    expect(searchButton).toBeInTheDocument()

    // Check for SVG icon
    const icon = searchButton.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('should handle empty search gracefully', () => {
    render(
      <SearchInput
        isVisible={true}
        onSearch={mockOnSearch}
        onClose={mockOnClose}
        initialValue=""
      />
    )

    const input = screen.getByRole('textbox', { name: /search pins/i })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockOnSearch).toHaveBeenCalledWith('')
  })
})
