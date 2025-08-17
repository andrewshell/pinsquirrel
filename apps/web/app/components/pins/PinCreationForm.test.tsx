import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRoutesStub } from 'react-router'
import { PinCreationForm } from './PinCreationForm'

// Define props interface locally since it's not exported
interface PinCreationFormProps {
  onMetadataFetch?: (url: string) => void
  metadataTitle?: string
  metadataError?: string
  isMetadataLoading?: boolean
  isLoading?: boolean
  successMessage?: string
  errorMessage?: string
  editMode?: boolean
  initialData?: {
    url: string
    title: string
    description: string
    readLater?: boolean
  }
  actionUrl?: string
}

// Helper to create route stub with component props
const createPinCreationFormStub = (
  props: Partial<PinCreationFormProps> = {}
) => {
  return createRoutesStub([
    {
      path: '/pins/new',
      Component: () => <PinCreationForm {...props} />,
      action: () => null, // Prevent form submission errors in tests
    },
  ])
}

describe('PinCreationForm', () => {
  const mockOnMetadataFetch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('submits directly to server without client-side validation', async () => {
    const user = userEvent.setup()
    const Stub = createPinCreationFormStub()
    render(<Stub initialEntries={['/pins/new']} />)

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
    const Stub = createPinCreationFormStub({ actionUrl: '/pins/123/edit' })
    render(<Stub initialEntries={['/pins/new']} />)

    const form = screen.getByRole('form', { name: /create new pin/i })
    expect(form).toHaveAttribute('action', '/pins/123/edit')
  })

  it('shows "Update Pin" button text in edit mode', () => {
    const Stub = createPinCreationFormStub({ editMode: true })
    render(<Stub initialEntries={['/pins/new']} />)

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

    const Stub = createPinCreationFormStub({ initialData })
    render(<Stub initialEntries={['/pins/new']} />)

    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument()
  })

  it('displays success message when provided', () => {
    const Stub = createPinCreationFormStub({
      successMessage: 'Pin created successfully!',
    })
    render(<Stub initialEntries={['/pins/new']} />)

    expect(screen.getByText('Pin created successfully!')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-lime-300')
  })

  it('displays error message when provided', () => {
    const Stub = createPinCreationFormStub({
      errorMessage: 'Something went wrong',
    })
    render(<Stub initialEntries={['/pins/new']} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveClass('bg-red-400')
  })

  it('calls onMetadataFetch when URL field loses focus with valid URL', async () => {
    const user = userEvent.setup()
    const Stub = createPinCreationFormStub({
      onMetadataFetch: mockOnMetadataFetch,
    })
    render(<Stub initialEntries={['/pins/new']} />)

    const urlInput = screen.getByLabelText(/url/i)

    await user.type(urlInput, 'https://example.com')
    await user.tab() // Trigger blur event

    expect(mockOnMetadataFetch).toHaveBeenCalledWith('https://example.com')
  })

  it('does not call onMetadataFetch with invalid URL', async () => {
    const user = userEvent.setup()
    const Stub = createPinCreationFormStub({
      onMetadataFetch: mockOnMetadataFetch,
    })
    render(<Stub initialEntries={['/pins/new']} />)

    const urlInput = screen.getByLabelText(/url/i)

    await user.type(urlInput, 'not-a-url')
    await user.tab()

    expect(mockOnMetadataFetch).not.toHaveBeenCalled()
  })

  it('does not call onMetadataFetch in edit mode', async () => {
    const user = userEvent.setup()
    const Stub = createPinCreationFormStub({
      editMode: true,
      onMetadataFetch: mockOnMetadataFetch,
    })
    render(<Stub initialEntries={['/pins/new']} />)

    const urlInput = screen.getByLabelText(/url/i)

    await user.type(urlInput, 'https://example.com')
    await user.tab()

    expect(mockOnMetadataFetch).not.toHaveBeenCalled()
  })

  it('shows metadata loading state', () => {
    const Stub = createPinCreationFormStub({ isMetadataLoading: true })
    render(<Stub initialEntries={['/pins/new']} />)

    expect(screen.getByText('Fetching page title...')).toBeInTheDocument()
  })

  it('shows metadata error message', () => {
    const Stub = createPinCreationFormStub({ metadataError: 'Failed to fetch' })
    render(<Stub initialEntries={['/pins/new']} />)

    expect(
      screen.getByText('Failed to fetch metadata. Please enter title manually.')
    ).toBeInTheDocument()
  })

  it('populates title field when metadata title is provided', async () => {
    const Stub1 = createPinCreationFormStub()
    const { rerender } = render(<Stub1 initialEntries={['/pins/new']} />)

    // Initially no title
    expect(screen.getByLabelText(/title/i)).toHaveValue('')

    // Provide metadata title
    const Stub2 = createPinCreationFormStub({
      metadataTitle: 'Page Title from Metadata',
    })
    rerender(<Stub2 initialEntries={['/pins/new']} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toHaveValue(
        'Page Title from Metadata'
      )
    })
  })

  describe('Read Later functionality', () => {
    it('renders a read later checkbox', () => {
      const Stub = createPinCreationFormStub()
      render(<Stub initialEntries={['/pins/new']} />)

      const checkbox = screen.getByRole('checkbox', { name: /read later/i })
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it('can be checked and unchecked', async () => {
      const user = userEvent.setup()
      const Stub = createPinCreationFormStub()
      render(<Stub initialEntries={['/pins/new']} />)

      const checkbox = screen.getByRole('checkbox', { name: /read later/i })

      // Initially unchecked
      expect(checkbox).not.toBeChecked()

      // Check it
      await user.click(checkbox)
      expect(checkbox).toBeChecked()

      // Uncheck it
      await user.click(checkbox)
      expect(checkbox).not.toBeChecked()
    })

    it('has proper form field name for submission', () => {
      const Stub = createPinCreationFormStub()
      render(<Stub initialEntries={['/pins/new']} />)

      const checkbox = screen.getByRole('checkbox', { name: /read later/i })
      expect(checkbox).toHaveAttribute('name', 'readLater')
    })

    it('pre-populates checkbox when initial data includes readLater: true', () => {
      const initialData = {
        url: 'https://example.com',
        title: 'Test Title',
        description: 'Test Description',
        readLater: true,
      }

      const Stub = createPinCreationFormStub({
        initialData,
        editMode: true,
      })
      render(<Stub initialEntries={['/pins/new']} />)

      const checkbox = screen.getByRole('checkbox', { name: /read later/i })
      expect(checkbox).toBeChecked()
    })

    it('checkbox is unchecked when initial data includes readLater: false', () => {
      const initialData = {
        url: 'https://example.com',
        title: 'Test Title',
        description: 'Test Description',
        readLater: false,
      }

      const Stub = createPinCreationFormStub({
        initialData,
        editMode: true,
      })
      render(<Stub initialEntries={['/pins/new']} />)

      const checkbox = screen.getByRole('checkbox', { name: /read later/i })
      expect(checkbox).not.toBeChecked()
    })
  })
})
