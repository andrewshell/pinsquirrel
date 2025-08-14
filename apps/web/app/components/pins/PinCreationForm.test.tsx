import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinCreationForm } from './PinCreationForm'

describe('PinCreationForm', () => {
  const mockOnMetadataFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits directly to server without client-side validation', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm />)

    const urlInput = screen.getByLabelText(/url/i)
    const titleInput = screen.getByLabelText(/title/i)
    const submitButton = screen.getByRole('button', { name: /create pin/i })

    // Fill in invalid URL but valid title
    await user.type(urlInput, 'not-a-valid-url')
    await user.type(titleInput, 'Test Title')
    await user.click(submitButton)

    // No client-side validation errors should appear
    expect(screen.queryByText(/invalid url/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/url is required/i)).not.toBeInTheDocument()
  })

  it('uses custom action URL when provided', () => {
    render(<PinCreationForm actionUrl="/pins/123/edit" />)

    const form = screen.getByRole('form', { name: /create new pin/i })
    expect(form).toHaveAttribute('action', '/pins/123/edit')
  })

  it('shows "Update Pin" button text in edit mode', () => {
    render(<PinCreationForm editMode />)

    expect(
      screen.getByRole('button', { name: /update pin/i })
    ).toBeInTheDocument()
  })

  it('pre-populates form fields with initial data', () => {
    const initialData = {
      url: 'https://example.com',
      title: 'Test Title',
      description: 'Test Description',
    }

    render(<PinCreationForm initialData={initialData} />)

    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument()
  })

  it('displays success message when provided', () => {
    render(<PinCreationForm successMessage="Pin created successfully!" />)

    expect(screen.getByText('Pin created successfully!')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50')
  })

  it('displays error message when provided', () => {
    render(<PinCreationForm errorMessage="Something went wrong" />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50')
  })

  it('calls onMetadataFetch when URL field loses focus with valid URL', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm onMetadataFetch={mockOnMetadataFetch} />)

    const urlInput = screen.getByLabelText(/url/i)

    await user.type(urlInput, 'https://example.com')
    await user.tab() // Trigger blur event

    expect(mockOnMetadataFetch).toHaveBeenCalledWith('https://example.com')
  })

  it('does not call onMetadataFetch with invalid URL', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm onMetadataFetch={mockOnMetadataFetch} />)

    const urlInput = screen.getByLabelText(/url/i)

    await user.type(urlInput, 'not-a-url')
    await user.tab()

    expect(mockOnMetadataFetch).not.toHaveBeenCalled()
  })

  it('does not call onMetadataFetch in edit mode', async () => {
    const user = userEvent.setup()
    render(<PinCreationForm editMode onMetadataFetch={mockOnMetadataFetch} />)

    const urlInput = screen.getByLabelText(/url/i)

    await user.type(urlInput, 'https://example.com')
    await user.tab()

    expect(mockOnMetadataFetch).not.toHaveBeenCalled()
  })

  it('shows metadata loading state', () => {
    render(<PinCreationForm isMetadataLoading />)

    expect(screen.getByText('Fetching page title...')).toBeInTheDocument()
  })

  it('shows metadata error message', () => {
    render(<PinCreationForm metadataError="Failed to fetch" />)

    expect(
      screen.getByText('Failed to fetch metadata. Please enter title manually.')
    ).toBeInTheDocument()
  })

  it('populates title field when metadata title is provided', async () => {
    const { rerender } = render(<PinCreationForm />)

    // Initially no title
    expect(screen.getByLabelText(/title/i)).toHaveValue('')

    // Provide metadata title
    rerender(<PinCreationForm metadataTitle="Page Title from Metadata" />)

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toHaveValue(
        'Page Title from Metadata'
      )
    })
  })
})
