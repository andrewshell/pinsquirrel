import type { FC } from 'hono/jsx'

interface FilterHeaderProps {
  activeTag?: string
  searchQuery?: string
  readFilter: 'all' | 'unread' | 'read'
  searchParams: string
  noTags?: boolean
}

// Build URL with updated read filter
function buildReadFilterUrl(
  currentParams: string,
  filter: 'all' | 'unread' | 'read'
): string {
  const params = new URLSearchParams(currentParams)

  if (filter === 'unread') {
    params.set('unread', 'true')
  } else if (filter === 'read') {
    params.set('unread', 'false')
  } else {
    params.delete('unread')
  }
  params.delete('page')

  return params.toString()
}

// Build URL with filter removed
function buildClearFilterUrl(
  currentParams: string,
  filterToRemove: 'tag' | 'search' | 'unread' | 'notags'
): string {
  const params = new URLSearchParams(currentParams)
  params.delete(filterToRemove)
  params.delete('page')
  return params.toString()
}

// Get label for read filter
function getReadFilterLabel(filter: 'all' | 'unread' | 'read'): string {
  switch (filter) {
    case 'all':
      return 'All Pins'
    case 'unread':
      return 'To Read'
    case 'read':
      return 'Read'
    default:
      return 'All Pins'
  }
}

export const FilterHeader: FC<FilterHeaderProps> = ({
  activeTag,
  searchQuery,
  readFilter,
  searchParams,
  noTags = false,
}) => {
  const hasActiveTag = activeTag && activeTag.trim()
  const hasActiveSearch = searchQuery && searchQuery.trim()

  return (
    <div class="mb-6">
      <label class="block text-sm font-bold text-foreground mb-2">
        FILTERS
      </label>
      <div class="border-4 border-foreground bg-input p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 flex-wrap">
            {/* Read Status Filter - Dropdown */}
            <div class="relative" x-data="{ open: false }">
              <button
                type="button"
                class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors"
                x-on:click="open = !open"
              >
                {/* Filter icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>{getReadFilterLabel(readFilter)}</span>
                {/* Chevron down icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="ml-1"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                x-show="open"
                x-cloak
                {...{ 'x-on:click.away': 'open = false' }}
                x-transition
                class="absolute left-0 mt-1 w-32 bg-background border-2 border-foreground shadow-lg z-50"
              >
                <a
                  href={`/pins?${buildReadFilterUrl(searchParams, 'all')}`}
                  class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                >
                  All Pins
                </a>
                <a
                  href={`/pins?${buildReadFilterUrl(searchParams, 'unread')}`}
                  class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                >
                  To Read
                </a>
                <a
                  href={`/pins?${buildReadFilterUrl(searchParams, 'read')}`}
                  class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                >
                  Read
                </a>
              </div>
            </div>

            {/* Active Tag Filter Pill */}
            {hasActiveTag && (
              <div class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                {/* Tag icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                </svg>
                <span>{activeTag}</span>
                <a
                  href={`/pins?${buildClearFilterUrl(searchParams, 'tag')}`}
                  class="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors"
                  aria-label={`Remove ${activeTag} tag filter`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </a>
              </div>
            )}

            {/* Active Search Filter Pill */}
            {hasActiveSearch && (
              <div class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                {/* Search icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span>"{searchQuery}"</span>
                <a
                  href={`/pins?${buildClearFilterUrl(searchParams, 'search')}`}
                  class="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors"
                  aria-label="Clear search"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </a>
              </div>
            )}

            {/* Untagged Filter Pill */}
            {noTags && (
              <div class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                {/* Tag icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
                  <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
                </svg>
                <span>Untagged</span>
                <a
                  href={`/pins?${buildClearFilterUrl(searchParams, 'notags')}`}
                  class="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors"
                  aria-label="Clear untagged filter"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
