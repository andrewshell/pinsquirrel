import type { FC } from 'hono/jsx'
import {
  ChevronDownIcon,
  CloseIcon,
  FunnelIcon,
  SearchIcon,
  TagIcon,
} from './icons'

interface FilterHeaderProps {
  activeTag?: string
  searchQuery?: string
  readFilter: 'all' | 'unread' | 'read'
  searchParams: string
  noTags?: boolean
  baseUrl?: string
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
  baseUrl = '/pins',
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
            <div class="relative" data-dropdown="container">
              <button
                type="button"
                class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors"
                data-dropdown="toggle"
              >
                {/* Filter icon */}
                <FunnelIcon size={12} />
                <span>{getReadFilterLabel(readFilter)}</span>
                {/* Chevron down icon */}
                <ChevronDownIcon size={12} class="ml-1" />
              </button>
              <div
                class="hidden absolute left-0 mt-1 w-32 bg-background border-2 border-foreground shadow-lg z-50"
                data-dropdown="menu"
              >
                <a
                  href={`${baseUrl}?${buildReadFilterUrl(searchParams, 'all')}`}
                  hx-get={`${baseUrl}?${buildReadFilterUrl(searchParams, 'all')}`}
                  hx-target="#pins-content"
                  hx-swap="innerHTML"
                  hx-push-url={`${baseUrl}?${buildReadFilterUrl(searchParams, 'all')}`}
                  class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                >
                  All Pins
                </a>
                <a
                  href={`${baseUrl}?${buildReadFilterUrl(searchParams, 'unread')}`}
                  hx-get={`${baseUrl}?${buildReadFilterUrl(searchParams, 'unread')}`}
                  hx-target="#pins-content"
                  hx-swap="innerHTML"
                  hx-push-url={`${baseUrl}?${buildReadFilterUrl(searchParams, 'unread')}`}
                  class="block px-3 py-2 text-sm hover:bg-accent/10 transition-colors"
                >
                  To Read
                </a>
                <a
                  href={`${baseUrl}?${buildReadFilterUrl(searchParams, 'read')}`}
                  hx-get={`${baseUrl}?${buildReadFilterUrl(searchParams, 'read')}`}
                  hx-target="#pins-content"
                  hx-swap="innerHTML"
                  hx-push-url={`${baseUrl}?${buildReadFilterUrl(searchParams, 'read')}`}
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
                <TagIcon size={12} />
                <span>{activeTag}</span>
                <a
                  href={`${baseUrl}?${buildClearFilterUrl(searchParams, 'tag')}`}
                  hx-get={`${baseUrl}?${buildClearFilterUrl(searchParams, 'tag')}`}
                  hx-target="#pins-content"
                  hx-swap="innerHTML"
                  hx-push-url={`${baseUrl}?${buildClearFilterUrl(searchParams, 'tag')}`}
                  class="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors"
                  aria-label={`Remove ${activeTag} tag filter`}
                >
                  <CloseIcon size={12} />
                </a>
              </div>
            )}

            {/* Active Search Filter Pill */}
            {hasActiveSearch && (
              <div class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                {/* Search icon */}
                <SearchIcon size={12} />
                <span>"{searchQuery}"</span>
                <a
                  href={`${baseUrl}?${buildClearFilterUrl(searchParams, 'search')}`}
                  hx-get={`${baseUrl}?${buildClearFilterUrl(searchParams, 'search')}`}
                  hx-target="#pins-content"
                  hx-swap="innerHTML"
                  hx-push-url={`${baseUrl}?${buildClearFilterUrl(searchParams, 'search')}`}
                  class="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors"
                  aria-label="Clear search"
                >
                  <CloseIcon size={12} />
                </a>
              </div>
            )}

            {/* Untagged Filter Pill */}
            {noTags && (
              <div class="inline-flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground">
                {/* Tag icon */}
                <TagIcon size={12} />
                <span>Untagged</span>
                <a
                  href={`${baseUrl}?${buildClearFilterUrl(searchParams, 'notags')}`}
                  hx-get={`${baseUrl}?${buildClearFilterUrl(searchParams, 'notags')}`}
                  hx-target="#pins-content"
                  hx-swap="innerHTML"
                  hx-push-url={`${baseUrl}?${buildClearFilterUrl(searchParams, 'notags')}`}
                  class="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-sm p-0.5 transition-colors"
                  aria-label="Clear untagged filter"
                >
                  <CloseIcon size={12} />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
