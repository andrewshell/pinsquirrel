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
  // Escape single quotes in tag names for JSON
  const tagsJson = JSON.stringify(initialTags)
  const allTagsJson = JSON.stringify(allTags)

  return (
    <div class="space-y-2">
      <label for={`${id}-input`} class="block text-sm font-medium">
        Tags (optional)
      </label>

      {/* Alpine.js component wrapper */}
      <div
        x-data={`tagInput({ tags: ${tagsJson}, allTags: ${allTagsJson}, inputId: '${id}-input' })`}
        class="relative"
      >
        {/* Tag pills and input container */}
        <div
          class={`flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[42px] border-2 border-foreground bg-background neobrutalism-shadow-sm
                  focus-within:outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2
                  ${error ? 'border-red-500' : ''}`}
        >
          {/* Existing tags as pills */}
          <template x-for="tag in tags" x-bind:key="tag">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-accent/10 text-accent border border-accent/30">
              <span x-text="tag"></span>
              <button
                type="button"
                class="text-accent/60 hover:text-accent focus:outline-none"
                x-on:click="removeTag(tag)"
                aria-label="Remove tag"
              >
                ×
              </button>
            </span>
          </template>

          {/* Text input */}
          <input
            type="text"
            id={`${id}-input`}
            x-ref="tagInput"
            x-model="input"
            x-on:keydown="handleKeydown($event)"
            x-on:focus="showSuggestions = input.length > 0 && filteredSuggestions.length > 0"
            x-on:blur="setTimeout(() => showSuggestions = false, 200)"
            placeholder="Add a tag..."
            autocomplete="off"
            class="flex-1 min-w-[120px] bg-transparent border-none outline-none text-sm"
            aria-describedby={`${id}-help`}
            aria-autocomplete="list"
            aria-controls={`${id}-suggestions`}
            x-bind:aria-expanded="showSuggestions"
            x-bind:aria-activedescendant="selectedIndex >= 0 ? `${id}-suggestion-` + selectedIndex : ''"
          />
        </div>

        {/* Hidden input for form submission */}
        <input type="hidden" name={name} x-bind:value="tagsValue" />

        {/* Suggestions dropdown */}
        <ul
          id={`${id}-suggestions`}
          x-show="showSuggestions && filteredSuggestions.length > 0"
          x-transition:enter="transition ease-out duration-100"
          x-transition:enter-start="opacity-0 transform scale-95"
          x-transition:enter-end="opacity-100 transform scale-100"
          x-transition:leave="transition ease-in duration-75"
          x-transition:leave-start="opacity-100 transform scale-100"
          x-transition:leave-end="opacity-0 transform scale-95"
          class="absolute z-10 mt-1 w-full max-h-60 overflow-auto bg-background border-2 border-foreground neobrutalism-shadow-sm"
          role="listbox"
        >
          <template
            x-for="(suggestion, index) in filteredSuggestions"
            x-bind:key="suggestion"
          >
            <li
              x-bind:id="`${inputId}-suggestion-${index}`"
              x-bind:class="{ 'bg-accent/10': index === selectedIndex }"
              x-on:click="selectSuggestion(suggestion)"
              x-on:mouseenter="selectedIndex = index"
              class="px-3 py-2 text-sm cursor-pointer hover:bg-accent/10"
              role="option"
              x-bind:aria-selected="index === selectedIndex"
            >
              <span x-text="suggestion"></span>
            </li>
          </template>
        </ul>
      </div>

      <p id={`${id}-help`} class="text-xs text-muted-foreground">
        Type a tag and press Enter or comma to add. Use arrow keys to navigate
        suggestions.
      </p>

      {error && <p class="text-sm text-red-600 font-medium">{error}</p>}
    </div>
  )
}
