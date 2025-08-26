import { useState, useRef, useId, useMemo } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '~/lib/utils'
import type { TagWithCount } from '@pinsquirrel/domain'

export interface TagSelectProps {
  tags: TagWithCount[]
  selectedTagId: string
  onSelectionChange: (tagId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function TagSelect({
  tags,
  selectedTagId,
  onSelectionChange,
  placeholder = 'Select a tag...',
  disabled = false,
  className,
  id,
}: TagSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const triggerRef = useRef<HTMLButtonElement>(null)
  const listboxId = useId()

  // Get selected tag for display
  const selectedTag = useMemo(() => {
    return tags.find(tag => tag.id === selectedTagId)
  }, [tags, selectedTagId])

  // Filter tags based on search value
  const filteredTags = useMemo(() => {
    if (!searchValue.trim()) return tags

    const search = searchValue.toLowerCase()
    return tags.filter(tag => tag.name.toLowerCase().includes(search))
  }, [tags, searchValue])

  const handleTagSelect = (tagId: string) => {
    onSelectionChange(tagId)
    setIsOpen(false)
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
          <span
            className={cn(
              'text-left truncate',
              !selectedTag && 'text-muted-foreground'
            )}
          >
            {selectedTag ? selectedTag.name : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
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
              {tags.length === 0 ? 'No tags available' : 'No tags found'}
            </div>
          ) : (
            filteredTags.map(tag => {
              const isSelected = tag.id === selectedTagId

              return (
                <button
                  key={tag.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleTagSelect(tag.id)}
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
