import * as React from 'react'
import { useState, useRef, useId, useMemo } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '~/lib/utils'
import type { TagWithCount } from '@pinsquirrel/core'

export interface TagMultiSelectProps {
  tags: TagWithCount[]
  selectedTagIds: string[]
  onSelectionChange: (tagIds: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function TagMultiSelect({
  tags,
  selectedTagIds,
  onSelectionChange,
  placeholder = 'Select tags...',
  disabled = false,
  className,
  id,
}: TagMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  // Get selected tags for display
  const selectedTags = useMemo(() => {
    const selectedSet = new Set(selectedTagIds)
    return tags.filter(tag => selectedSet.has(tag.id))
  }, [tags, selectedTagIds])

  // Filter tags based on search value
  const filteredTags = useMemo(() => {
    if (!searchValue.trim()) return tags

    const search = searchValue.toLowerCase()
    return tags.filter(tag => tag.name.toLowerCase().includes(search))
  }, [tags, searchValue])

  const handleTagToggle = (tagId: string) => {
    const newSelectedIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter(id => id !== tagId)
      : [...selectedTagIds, tagId]

    onSelectionChange(newSelectedIds)
  }

  const handleRemoveTag = (tagId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectionChange(selectedTagIds.filter(id => id !== tagId))
  }

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          id={id}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-labelledby={`${id}-label`}
        >
          <div className="flex flex-wrap gap-1 flex-1 min-w-0">
            {selectedTags.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={e => handleRemoveTag(tag.id, e)}
                    className="hover:bg-secondary-foreground/20 rounded p-0.5"
                    aria-label={`Remove ${tag.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </Popover.Trigger>

      <Popover.Content
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-background border border-border rounded-md shadow-md z-50"
        align="start"
        sideOffset={4}
      >
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchValue}
            onChange={e => setSearchValue(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-background border border-input rounded focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div
          role="listbox"
          id={listboxId}
          className="max-h-60 overflow-y-auto py-1"
        >
          {filteredTags.length === 0 ? (
            <div className="px-2 py-2 text-sm text-muted-foreground">
              No tags found
            </div>
          ) : (
            filteredTags.map(tag => {
              const isSelected = selectedTagIds.includes(tag.id)

              return (
                <button
                  key={tag.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleTagToggle(tag.id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2 py-2 text-sm text-left',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:outline-none focus:bg-accent focus:text-accent-foreground',
                    isSelected && 'bg-accent text-accent-foreground'
                  )}
                >
                  <div className="flex items-center justify-center w-4 h-4">
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                  <span className="flex-1">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tag.pinCount}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
