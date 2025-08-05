import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinCreationForm } from './PinCreationForm'

describe('PinCreationForm', () => {
  const mockOnSubmit = vi.fn()
  const mockOnMetadataFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form fields (URL, title, description)', () => {
    render(<PinCreationForm onSubmit={mockOnSubmit} />)

    expect(screen.getByLabelText(/url/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create pin/i })).toBeInTheDocument()
  })

  it('does not call onSubmit when URL is invalid', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm onSubmit={mockOnSubmit} />)

    const urlInput = screen.getByLabelText(/url/i)
    const titleInput = screen.getByLabelText(/title/i)
    const submitButton = screen.getByRole('button', { name: /create pin/i })

    // Fill in invalid URL but valid title
    await user.type(urlInput, 'not-a-valid-url')
    await user.type(titleInput, 'Test Title')
    await user.click(submitButton)

    // Wait a bit to ensure form submission would have happened
    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  it('does not call onSubmit when required fields are empty', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm onSubmit={mockOnSubmit} />)

    const submitButton = screen.getByRole('button', { name: /create pin/i })
    await user.click(submitButton)

    // Wait a bit to ensure form submission would have happened
    await waitFor(() => {
      expect(mockOnSubmit).not.toHaveBeenCalled()
    })
  })

  it('calls onSubmit with correct data when form is valid', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm onSubmit={mockOnSubmit} />)

    const urlInput = screen.getByLabelText(/url/i)
    const titleInput = screen.getByLabelText(/title/i)
    const descriptionInput = screen.getByLabelText(/description/i)
    const submitButton = screen.getByRole('button', { name: /create pin/i })

    await user.type(urlInput, 'https://example.com')
    await user.type(titleInput, 'Example Title')
    await user.type(descriptionInput, 'Example description')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        url: 'https://example.com',
        title: 'Example Title',
        description: 'Example description'
      })
    })
  })

  it('disables submit button during loading state', () => {
    render(<PinCreationForm onSubmit={mockOnSubmit} isLoading />)

    const submitButton = screen.getByRole('button', { name: /creating/i })
    expect(submitButton).toBeDisabled()
  })

  it('displays success message after successful submission', () => {
    render(<PinCreationForm onSubmit={mockOnSubmit} successMessage="Pin created successfully!" />)

    expect(screen.getByText('Pin created successfully!')).toBeInTheDocument()
  })

  it('displays error message when submission fails', () => {
    render(<PinCreationForm onSubmit={mockOnSubmit} errorMessage="Failed to create pin" />)

    expect(screen.getByText('Failed to create pin')).toBeInTheDocument()
  })

  it('auto-populates title when URL metadata is fetched', async () => {
    const user = userEvent.setup()
    render(
      <PinCreationForm 
        onSubmit={mockOnSubmit} 
        onMetadataFetch={mockOnMetadataFetch}
        metadataTitle="Fetched Page Title"
      />
    )

    const urlInput = screen.getByLabelText(/url/i)
    const titleInput = screen.getByLabelText(/title/i)

    await user.type(urlInput, 'https://example.com')
    await user.tab() // Trigger blur event

    await waitFor(() => {
      expect(mockOnMetadataFetch).toHaveBeenCalledWith('https://example.com')
    })

    // Simulate metadata being fetched and passed back
    expect((titleInput as HTMLInputElement).value).toBe('Fetched Page Title')
  })

  it('allows manual override of auto-populated title', async () => {
    const user = userEvent.setup()
    render(
      <PinCreationForm 
        onSubmit={mockOnSubmit} 
        metadataTitle="Fetched Page Title"
      />
    )

    const titleInput = screen.getByLabelText(/title/i)
    
    // Clear and type new title
    await user.clear(titleInput)
    await user.type(titleInput, 'My Custom Title')

    expect((titleInput as HTMLInputElement).value).toBe('My Custom Title')
  })

  it('handles metadata fetching errors gracefully', async () => {
    const user = userEvent.setup()
    render(
      <PinCreationForm 
        onSubmit={mockOnSubmit} 
        onMetadataFetch={mockOnMetadataFetch}
        metadataError="Failed to fetch metadata"
      />
    )

    const urlInput = screen.getByLabelText(/url/i)
    await user.type(urlInput, 'https://example.com')
    await user.tab()

    // Should not prevent form submission
    const submitButton = screen.getByRole('button', { name: /create pin/i })
    expect(submitButton).not.toBeDisabled()
    
    // Optionally show error but don't block functionality
    expect(screen.queryByText(/failed to fetch metadata/i)).toBeInTheDocument()
  })

  it('shows loading state during metadata fetch', () => {
    render(
      <PinCreationForm 
        onSubmit={mockOnSubmit} 
        isMetadataLoading
      />
    )

    expect(screen.getByText(/fetching page title/i)).toBeInTheDocument()
  })
})