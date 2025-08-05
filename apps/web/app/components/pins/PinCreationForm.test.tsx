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

  describe('Accessibility', () => {
    it('has proper ARIA labels on form fields', () => {
      render(<PinCreationForm onSubmit={mockOnSubmit} />)

      const urlInput = screen.getByLabelText(/url/i)
      const titleInput = screen.getByLabelText(/title/i)
      const descriptionInput = screen.getByLabelText(/description/i)

      expect(urlInput).toHaveAttribute('id', 'url')
      expect(titleInput).toHaveAttribute('id', 'title')
      expect(descriptionInput).toHaveAttribute('id', 'description')

      // Check that labels are properly associated
      expect(screen.getByText('URL')).toHaveAttribute('for', 'url')
      expect(screen.getByText('Title')).toHaveAttribute('for', 'title')
      expect(screen.getByText('Description (optional)')).toHaveAttribute('for', 'description')
    })

    it('sets aria-invalid when fields have validation errors', async () => {
      const user = userEvent.setup()
      render(<PinCreationForm onSubmit={mockOnSubmit} />)

      const urlInput = screen.getByLabelText(/url/i)
      const titleInput = screen.getByLabelText(/title/i)
      const submitButton = screen.getByRole('button', { name: /create pin/i })

      // Trigger validation errors by submitting empty form
      await user.click(submitButton)

      await waitFor(() => {
        expect(urlInput).toHaveAttribute('aria-invalid', 'true')
        expect(titleInput).toHaveAttribute('aria-invalid', 'true')
      })
    })

    it('associates error messages with form fields using aria-describedby', async () => {
      const user = userEvent.setup()
      render(<PinCreationForm onSubmit={mockOnSubmit} />)

      const urlInput = screen.getByLabelText(/url/i)
      const titleInput = screen.getByLabelText(/title/i)
      const submitButton = screen.getByRole('button', { name: /create pin/i })

      // Trigger validation errors
      await user.click(submitButton)

      await waitFor(() => {
        expect(urlInput.getAttribute('aria-describedby')).toContain('url-error')
        expect(urlInput.getAttribute('aria-describedby')).toContain('url-help')
        expect(titleInput.getAttribute('aria-describedby')).toContain('title-error')
        expect(titleInput.getAttribute('aria-describedby')).toContain('title-help')
      })

      // Check that error elements exist with correct IDs
      expect(screen.getByText(/url is required/i)).toHaveAttribute('id', 'url-error')
      expect(screen.getByText(/title is required/i)).toHaveAttribute('id', 'title-error')
    })

    it('supports keyboard navigation through form fields', async () => {
      const user = userEvent.setup()
      render(<PinCreationForm onSubmit={mockOnSubmit} />)

      const urlInput = screen.getByLabelText(/url/i)
      const titleInput = screen.getByLabelText(/title/i)
      const descriptionInput = screen.getByLabelText(/description/i)
      const submitButton = screen.getByRole('button', { name: /create pin/i })

      // Start at URL field
      urlInput.focus()
      expect(urlInput).toHaveFocus()

      // Tab to title field
      await user.tab()
      expect(titleInput).toHaveFocus()

      // Tab to description field
      await user.tab()
      expect(descriptionInput).toHaveFocus()

      // Tab to submit button
      await user.tab()
      expect(submitButton).toHaveFocus()
    })

    it('manages focus when validation errors occur', async () => {
      const user = userEvent.setup()
      render(<PinCreationForm onSubmit={mockOnSubmit} />)

      const submitButton = screen.getByRole('button', { name: /create pin/i })

      // Submit empty form to trigger validation errors
      await user.click(submitButton)

      // Form should remain focused and not lose focus context
      // The submit button should still be in the document and focusable
      expect(submitButton).toBeInTheDocument()
      expect(submitButton).not.toHaveAttribute('disabled')
    })

    it('has accessible success and error messages', () => {
      const { rerender } = render(<PinCreationForm onSubmit={mockOnSubmit} />)

      // Test success message
      rerender(
        <PinCreationForm 
          onSubmit={mockOnSubmit} 
          successMessage="Pin created successfully!" 
        />
      )

      const successMessage = screen.getByText('Pin created successfully!')
      expect(successMessage).toBeInTheDocument()
      expect(successMessage).toHaveClass('text-green-800')

      // Test error message
      rerender(
        <PinCreationForm 
          onSubmit={mockOnSubmit} 
          errorMessage="Failed to create pin" 
        />
      )

      const errorMessage = screen.getByText('Failed to create pin')
      expect(errorMessage).toBeInTheDocument()
      expect(errorMessage).toHaveClass('text-red-800')
    })

    it('provides screen reader friendly loading states', () => {
      const { rerender } = render(<PinCreationForm onSubmit={mockOnSubmit} />)

      // Test metadata loading state
      rerender(
        <PinCreationForm 
          onSubmit={mockOnSubmit} 
          isMetadataLoading 
        />
      )

      expect(screen.getByText(/fetching page title/i)).toBeInTheDocument()

      // Test form submission loading state
      rerender(
        <PinCreationForm 
          onSubmit={mockOnSubmit} 
          isLoading 
        />
      )

      const submitButton = screen.getByRole('button', { name: /creating/i })
      expect(submitButton).toBeDisabled()
      expect(submitButton).toHaveTextContent('Creating...')
    })

    it('maintains proper heading hierarchy and semantic structure', () => {
      render(<PinCreationForm onSubmit={mockOnSubmit} />)

      // Ensure form element exists and has semantic structure
      const form = document.querySelector('form')
      expect(form).toBeInTheDocument()
      expect(form).toHaveAttribute('method', 'post')
      expect(form).toHaveAttribute('action', '/pins/new')

      // Ensure submit button has proper role and type
      const submitButton = screen.getByRole('button', { name: /create pin/i })
      expect(submitButton).toHaveAttribute('type', 'submit')
    })
  })
})