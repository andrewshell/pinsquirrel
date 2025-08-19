import * as React from 'react'
import { useState, useRef, useId, useMemo } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { X } from 'lucide-react'
import { cn } from '~/lib/utils'
import { tagNameSchema } from '@pinsquirrel/core'

export interface TagInputProps {
  tags: string[]
  onTagsChange: (tags: string[]) => void
  suggestions: string[]
  placeholder?: string
  disabled?: boolean
  maxTags?: number
  className?: string
  id?: string
  'aria-labelledby'?: string
}

export function TagInput({
  tags,
  onTagsChange,
  suggestions,
  placeholder = 'Add tags...',
  disabled = false,
  maxTags,
  className,
  id,
  'aria-labelledby': ariaLabelledBy,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [validationError, setValidationError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const listboxId = useId()
  const descriptionId = useId()

  // Filter suggestions based on input value and exclude already selected tags
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return []

    const normalizedInput = inputValue.toLowerCase()
    return suggestions.filter(suggestion => {
      const normalizedSuggestion = suggestion.toLowerCase()
      return (
        normalizedSuggestion.includes(normalizedInput) &&
        !tags.includes(normalizedSuggestion)
      )
    })
  }, [inputValue, suggestions, tags])

  // Update popover state based on filtered suggestions
  React.useEffect(() => {
    setIsOpen(filteredSuggestions.length > 0 && inputValue.trim().length > 0)
    setSelectedIndex(-1)
  }, [filteredSuggestions.length, inputValue])

  const validateTag = (tagName: string) => {
    const result = tagNameSchema.safeParse(tagName)
    if (!result.success) {
      return result.error.issues?.[0]?.message || 'Invalid tag name'
    }
    return null
  }

  const addTag = (tagName: string) => {
    const normalizedTag = tagName.trim().toLowerCase()

    if (!normalizedTag) return

    // Validate tag name
    const error = validateTag(normalizedTag)
    if (error) {
      setValidationError(error)
      return
    }

    // Check for duplicates
    if (tags.includes(normalizedTag)) return

    // Check max tags limit
    if (maxTags && tags.length >= maxTags) return

    onTagsChange([...tags, normalizedTag])
    setInputValue('')
    setValidationError(null)
    inputRef.current?.focus()
  }

  const removeTag = (index: number) => {
    const newTags = tags.filter((_, i) => i !== index)
    onTagsChange(newTags)
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Handle comma-separated input
    if (value.includes(',')) {
      const newTag = value.replace(',', '').trim()
      if (newTag) {
        addTag(newTag)
      } else {
        setInputValue('')
      }
      return
    }

    setInputValue(value)
    setValidationError(null)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          addTag(filteredSuggestions[selectedIndex])
        } else if (inputValue.trim()) {
          addTag(inputValue)
        }
        break

      case 'Backspace':
        if (!inputValue && tags.length > 0) {
          removeTag(tags.length - 1)
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (filteredSuggestions.length > 0) {
          const nextIndex =
            selectedIndex < filteredSuggestions.length - 1
              ? selectedIndex + 1
              : 0
          setSelectedIndex(nextIndex)
          suggestionRefs.current[nextIndex]?.scrollIntoView({
            block: 'nearest',
          })
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (filteredSuggestions.length > 0) {
          const nextIndex =
            selectedIndex > 0
              ? selectedIndex - 1
              : filteredSuggestions.length - 1
          setSelectedIndex(nextIndex)
          suggestionRefs.current[nextIndex]?.scrollIntoView({
            block: 'nearest',
          })
        }
        break

      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Don't add tag if clicking on a suggestion
    if (e.relatedTarget?.closest('[role="listbox"]')) {
      return
    }

    if (inputValue.trim()) {
      addTag(inputValue)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion)
  }

  const isAtMaxTags = maxTags ? tags.length >= maxTags : false

  return (
    <div className={cn('relative', className)}>
      <Popover.Root open={isOpen && !disabled}>
        <Popover.Anchor asChild>
          <div
            className={cn(
              'flex min-h-12 w-full flex-wrap items-center gap-2 border-4 border-foreground bg-input p-3 transition-all focus-within:neobrutalism-shadow',
              disabled && 'opacity-50 cursor-not-allowed',
              validationError && 'border-destructive bg-destructive/10'
            )}
          >
            {/* Render existing tags */}
            {tags.map((tag, index) => (
              <div
                key={tag}
                className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  disabled={disabled}
                  className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors focus:outline-none focus:ring-1 focus:ring-foreground"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Input field */}
            <input
              ref={inputRef}
              id={id}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onBlur={handleInputBlur}
              disabled={disabled || isAtMaxTags}
              placeholder={
                isAtMaxTags ? `Maximum ${maxTags} tags` : placeholder
              }
              className="flex-1 min-w-[120px] bg-transparent text-sm font-medium placeholder:text-muted-foreground placeholder:font-bold focus:outline-none disabled:cursor-not-allowed"
              role="textbox"
              aria-expanded={isOpen}
              aria-haspopup="listbox"
              aria-controls={isOpen ? listboxId : undefined}
              aria-activedescendant={
                selectedIndex >= 0
                  ? `${listboxId}-option-${selectedIndex}`
                  : undefined
              }
              aria-describedby={descriptionId}
              aria-labelledby={ariaLabelledBy}
              aria-invalid={!!validationError}
            />
          </div>
        </Popover.Anchor>

        <Popover.Content
          side="bottom"
          align="start"
          className="z-50 w-full border-4 border-foreground bg-popover p-0 text-popover-foreground shadow-lg"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <ul role="listbox" id={listboxId} className="max-h-48 overflow-auto">
            {filteredSuggestions.map((suggestion, index) => (
              <li key={suggestion} role="presentation">
                <button
                  ref={el => {
                    suggestionRefs.current[index] = el
                  }}
                  type="button"
                  role="option"
                  id={`${listboxId}-option-${index}`}
                  aria-selected={index === selectedIndex}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none',
                    index === selectedIndex &&
                      'bg-accent text-accent-foreground'
                  )}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Root>

      {/* Screen reader description */}
      <div id={descriptionId} className="sr-only">
        Enter tags separated by commas or press Enter to add. Use arrow keys to
        navigate suggestions.
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      )}
    </div>
  )
}
