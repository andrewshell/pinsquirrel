import type { FC } from 'hono/jsx'
import type { TagWithCount } from '@pinsquirrel/domain'

interface TagSelectDropdownProps {
  tags: TagWithCount[]
  selectedIds: string[]
  multiple?: boolean
  name: string
  placeholder?: string
  excludeSourceSelector?: string
}

export const TagSelectDropdown: FC<TagSelectDropdownProps> = ({
  tags,
  selectedIds,
  multiple = false,
  name,
  placeholder = 'Select tags...',
  excludeSourceSelector,
}) => {
  const tagsJson = JSON.stringify(
    tags.map((t) => ({ id: t.id, name: t.name, pinCount: t.pinCount }))
  )
  const selectedJson = JSON.stringify(selectedIds)

  // Get selected tags for initial render
  const selectedTags = tags.filter((t) => selectedIds.includes(t.id))

  return (
    <div
      class="relative"
      data-tag-select="container"
      data-tags={tagsJson}
      data-selected={selectedJson}
      data-multiple={multiple ? 'true' : 'false'}
      data-exclude-source={excludeSourceSelector || ''}
    >
      {/* Trigger button */}
      <button
        type="button"
        class="flex w-full items-center justify-between px-3 py-2 text-sm border-2 border-foreground bg-background
               hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        data-tag-select="trigger"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <div
          class="flex flex-wrap gap-1 flex-1 min-w-0 text-left"
          data-tag-select="display"
        >
          {selectedTags.length === 0 ? (
            <span class="text-muted-foreground" data-tag-select="placeholder">
              {placeholder}
            </span>
          ) : multiple ? (
            selectedTags.map((tag) => (
              <span
                key={tag.id}
                class="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground border-2 border-foreground text-xs"
                data-tag-select="pill"
                data-tag-id={tag.id}
              >
                {tag.name}
                <button
                  type="button"
                  class="hover:text-destructive focus:outline-none"
                  data-tag-select="remove"
                  data-tag-id={tag.id}
                  aria-label={`Remove ${tag.name}`}
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span data-tag-select="selected-text">{selectedTags[0]?.name}</span>
          )}
        </div>
        {/* Chevron icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="opacity-50 flex-shrink-0 ml-2"
          data-tag-select="chevron"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
      <div
        class="hidden absolute z-50 mt-1 w-full bg-background border-2 border-foreground neobrutalism-shadow"
        data-tag-select="dropdown"
      >
        {/* Search input */}
        <div class="p-2 border-b-2 border-foreground">
          <input
            type="text"
            placeholder="Search tags..."
            class="w-full px-2 py-1 text-sm bg-background border-2 border-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            data-tag-select="search"
          />
        </div>

        {/* Tag list */}
        <div
          class="max-h-60 overflow-y-auto py-1"
          role="listbox"
          data-tag-select="list"
        >
          {tags.map((tag) => {
            const isSelected = selectedIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                role="option"
                aria-selected={isSelected ? 'true' : 'false'}
                class={`flex w-full items-center gap-2 px-3 py-2 text-sm text-left
                       hover:bg-muted/50 focus:outline-none focus:bg-muted/50
                       ${isSelected ? 'bg-muted/30' : ''}`}
                data-tag-select="option"
                data-tag-id={tag.id}
                data-tag-name={tag.name}
              >
                {/* Checkmark space */}
                <div class="flex items-center justify-center w-4 h-4">
                  {isSelected && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      data-tag-select="check"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
                <span class="flex-1" data-tag-select="option-name">
                  {tag.name}
                </span>
                <span
                  class="text-xs text-muted-foreground"
                  data-tag-select="option-count"
                >
                  {tag.pinCount}
                </span>
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        <div
          class="hidden px-3 py-2 text-sm text-muted-foreground"
          data-tag-select="empty"
        >
          No tags found
        </div>
      </div>

      {/* Hidden input for form submission */}
      <input
        type="hidden"
        name={name}
        value={selectedIds.join(',')}
        data-tag-select="hidden"
      />
    </div>
  )
}
