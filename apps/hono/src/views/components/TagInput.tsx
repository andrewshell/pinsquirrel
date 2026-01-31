import type { FC } from 'hono/jsx'

interface TagInputProps {
  id?: string
  name?: string
  initialTags?: string[]
  allTags?: string[]
  error?: string
}

export const TagInput: FC<TagInputProps> = ({
  id = 'tags',
  name = 'tags',
  initialTags = [],
  allTags = [],
  error,
}) => {
  const tagsJson = JSON.stringify(initialTags)
  const allTagsJson = JSON.stringify(allTags)

  return (
    <div class="space-y-2">
      <label for={`${id}-input`} class="block text-sm font-medium">
        Tags (optional)
      </label>

      {/* Vanilla JS component wrapper */}
      <div
        data-tag-input="container"
        data-initial-tags={tagsJson}
        data-all-tags={allTagsJson}
        class="relative"
      >
        {/* Tag pills and input container */}
        <div
          class={`flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[42px] border-2 border-foreground bg-background neobrutalism-shadow-sm
                  focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2
                  ${error ? 'border-red-500' : ''}`}
          data-tag-input="pills"
        >
          {/* Initial tags rendered server-side (will be replaced by JS) */}
          {initialTags.map((tag) => (
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-accent/10 text-accent border border-accent/30"
              data-tag-pill={tag}
            >
              <span>{tag}</span>
              <button
                type="button"
                class="text-accent/60 hover:text-accent focus:outline-none"
                data-remove-tag={tag}
                aria-label="Remove tag"
              >
                ×
              </button>
            </span>
          ))}

          {/* Text input */}
          <input
            type="text"
            id={`${id}-input`}
            placeholder="Add a tag..."
            autocomplete="off"
            class="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
            aria-describedby={`${id}-help`}
            data-tag-input="input"
          />
        </div>

        {/* Hidden input for form submission */}
        <input
          type="hidden"
          name={name}
          value={initialTags.join(',')}
          data-tag-input="hidden"
        />

        {/* Suggestions dropdown */}
        <ul
          class="hidden absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-background border-2 border-foreground neobrutalism-shadow-sm"
          data-tag-input="suggestions"
        ></ul>
      </div>

      <p id={`${id}-help`} class="text-xs text-muted-foreground">
        Type a tag and press Enter or comma to add. Use arrow keys to navigate
        suggestions.
      </p>

      {error && <p class="text-sm text-red-600 font-medium">{error}</p>}
    </div>
  )
}
