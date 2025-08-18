import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagInput } from './tag-input'

describe('TagInput', () => {
  const mockOnTagsChange = vi.fn()
  const defaultProps = {
    tags: [],
    onTagsChange: mockOnTagsChange,
    suggestions: ['javascript', 'react', 'typescript', 'nodejs'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with empty tags list', () => {
      render(<TagInput {...defaultProps} />)

      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByRole('textbox')).toHaveValue('')
    })

    it('renders with existing tags as chips', () => {
      render(<TagInput {...defaultProps} tags={['react', 'javascript']} />)

      expect(screen.getByText('react')).toBeInTheDocument()
      expect(screen.getByText('javascript')).toBeInTheDocument()
    })

    it('renders with custom placeholder', () => {
      render(<TagInput {...defaultProps} placeholder="Add tags..." />)

      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'Add tags...'
      )
    })

    it('renders disabled state', () => {
      render(<TagInput {...defaultProps} disabled />)

      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  describe('Tag Addition', () => {
    it('adds tag when Enter is pressed', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'newtag')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['newtag'])
    })

    it('adds tag when comma is typed', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'newtag,')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['newtag'])
    })

    it('adds tag when input loses focus with value', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'newtag')
      await user.tab()

      expect(mockOnTagsChange).toHaveBeenCalledWith(['newtag'])
    })

    it('does not add empty tags', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })

    it('does not add duplicate tags', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} tags={['existing']} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'existing')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })

    it('respects maxTags limit', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} tags={['tag1', 'tag2']} maxTags={2} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'tag3')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })

    it('trims whitespace from tags', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, '  newtag  ')
      await user.keyboard('{Enter}')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['newtag'])
    })
  })

  describe('Tag Removal', () => {
    it('removes tag when clicking remove button', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} tags={['react', 'javascript']} />)

      const removeButtons = screen.getAllByRole('button', {
        name: /remove tag/i,
      })
      await user.click(removeButtons[0])

      expect(mockOnTagsChange).toHaveBeenCalledWith(['javascript'])
    })

    it('removes last tag when Backspace is pressed on empty input', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} tags={['react', 'javascript']} />)

      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.keyboard('{Backspace}')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['react'])
    })
  })

  describe('Autocomplete Functionality', () => {
    it('shows suggestions dropdown when typing', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'java')

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument()
      })
    })

    it('filters suggestions based on input value', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'react')

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument()
        expect(screen.queryByText('javascript')).not.toBeInTheDocument()
      })
    })

    it('hides suggestions that are already selected', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} tags={['react']} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'react')

      await waitFor(() => {
        // Should not show 'react' in suggestions since it's already selected
        // Check within the dropdown specifically
        const suggestionsList = screen.queryByRole('listbox')
        if (suggestionsList) {
          expect(suggestionsList).not.toHaveTextContent('react')
        }
      })
    })

    it('selects suggestion with Enter key', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'java')

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument()
      })

      await user.keyboard('{ArrowDown}{Enter}')

      expect(mockOnTagsChange).toHaveBeenCalledWith(['javascript'])
    })

    it('selects suggestion with mouse click', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'java')

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument()
      })

      await user.click(screen.getByText('javascript'))

      expect(mockOnTagsChange).toHaveBeenCalledWith(['javascript'])
    })
  })

  describe('Keyboard Navigation', () => {
    it('navigates suggestions with arrow keys', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'j')

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument()
      })

      await user.keyboard('{ArrowDown}')

      // Should highlight first suggestion
      expect(screen.getByText('javascript')).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })

    it('wraps navigation at list boundaries', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'j')

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument()
      })

      await user.keyboard('{ArrowUp}')

      // Should wrap to last item when going up from first
      const suggestions = screen.getAllByRole('option')
      expect(suggestions[suggestions.length - 1]).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
  })

  describe('Validation', () => {
    it('shows validation error for invalid tag names', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'invalid\x00tag')
      await user.keyboard('{Enter}')

      expect(
        screen.getByText(/tag name cannot contain control characters/i)
      ).toBeInTheDocument()
      expect(mockOnTagsChange).not.toHaveBeenCalled()
    })

    it('clears validation error when input changes', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'invalid\x01tag')
      await user.keyboard('{Enter}')

      expect(
        screen.getByText(/tag name cannot contain control characters/i)
      ).toBeInTheDocument()

      await user.clear(input)
      await user.type(input, 'valid')

      await waitFor(() => {
        expect(
          screen.queryByText(/tag name cannot contain control characters/i)
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<TagInput {...defaultProps} />)

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby')
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    })

    it('updates aria-expanded when suggestions are shown', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'j')

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-expanded', 'true')
      })
    })

    it('has proper aria-activedescendant when navigating suggestions', async () => {
      const user = userEvent.setup()
      render(<TagInput {...defaultProps} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'j')

      await waitFor(() => {
        expect(screen.getByText('javascript')).toBeInTheDocument()
      })

      await user.keyboard('{ArrowDown}')

      expect(input).toHaveAttribute('aria-activedescendant')
    })
  })
})
