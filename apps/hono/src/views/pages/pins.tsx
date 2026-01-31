import type { FC } from 'hono/jsx'
import type { Pin, Pagination } from '@pinsquirrel/domain'
import { BaseLayout } from '../layouts/base'
import { PinListPartial } from '../partials/pin-list'
import type { FlashType } from '../../middleware/session'

interface PinsPageProps {
  pins: Pin[]
  pagination: Pagination
  totalCount: number
  searchParams?: string
  activeTag?: string
  searchQuery?: string
  readFilter?: 'all' | 'unread' | 'read'
  flash?: { type: FlashType; message: string } | null
}

// Build partial URL for HTMX requests
function buildPartialUrl(currentParams: string): string {
  return `/pins/partial?${currentParams}`
}

// Build filter clear URL (for both regular links and HTMX)
function buildClearFilterUrl(
  currentParams: string,
  filterToRemove: 'tag' | 'search' | 'unread'
): string {
  const params = new URLSearchParams(currentParams)
  params.delete(filterToRemove)
  params.delete('page') // Reset to page 1 when changing filters
  return params.toString()
}

const FilterHeader: FC<{
  activeTag?: string
  searchQuery?: string
  readFilter?: 'all' | 'unread' | 'read'
  searchParams: string
}> = ({ activeTag, searchQuery, readFilter, searchParams }) => {
  const hasFilters: boolean =
    !!activeTag ||
    !!searchQuery ||
    (readFilter !== undefined && readFilter !== 'all')

  // Build the base params without search for the form
  const baseParams = new URLSearchParams(searchParams)
  baseParams.delete('search')
  baseParams.delete('page')

  return (
    <div class="mb-6">
      {/* Search bar with HTMX */}
      <div class="mb-4">
        <form
          class="flex gap-2"
          hx-get="/pins/partial"
          hx-target="#pin-list"
          hx-swap="innerHTML"
          hx-push-url="true"
          hx-include="[name='tag'], [name='unread']"
        >
          {/* Preserve existing filters */}
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          {readFilter && readFilter !== 'all' && (
            <input
              type="hidden"
              name="unread"
              value={readFilter === 'unread' ? 'true' : 'false'}
            />
          )}
          <input
            type="search"
            name="search"
            value={searchQuery || ''}
            placeholder="Search pins..."
            class="flex-1 px-3 py-2 border-2 border-foreground bg-background neobrutalism-shadow-sm
                   focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            hx-get="/pins/partial"
            hx-target="#pin-list"
            hx-swap="innerHTML"
            hx-trigger="keyup changed delay:300ms"
            hx-push-url="true"
            hx-include="closest form"
          />
          <button
            type="submit"
            class="px-4 py-2 bg-primary text-primary-foreground font-medium
                   border-2 border-foreground neobrutalism-shadow
                   hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                   active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                   transition-all"
          >
            Search
          </button>
        </form>
      </div>

      {/* Active filters display */}
      {hasFilters && (
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-sm text-muted-foreground">Filters:</span>

          {activeTag && (
            <span class="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-sm border border-accent/30">
              tag: {activeTag}
              <a
                href={`/pins?${buildClearFilterUrl(searchParams, 'tag')}`}
                hx-get={`/pins/partial?${buildClearFilterUrl(searchParams, 'tag')}`}
                hx-target="#pin-list"
                hx-swap="innerHTML"
                hx-push-url={`/pins?${buildClearFilterUrl(searchParams, 'tag')}`}
                class="hover:text-destructive ml-1"
                aria-label={`Remove tag filter: ${activeTag}`}
              >
                ×
              </a>
            </span>
          )}

          {searchQuery && (
            <span class="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-sm border border-accent/30">
              search: {searchQuery}
              <a
                href={`/pins?${buildClearFilterUrl(searchParams, 'search')}`}
                hx-get={`/pins/partial?${buildClearFilterUrl(searchParams, 'search')}`}
                hx-target="#pin-list"
                hx-swap="innerHTML"
                hx-push-url={`/pins?${buildClearFilterUrl(searchParams, 'search')}`}
                class="hover:text-destructive ml-1"
                aria-label="Remove search filter"
              >
                ×
              </a>
            </span>
          )}

          {readFilter === 'unread' && (
            <span class="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent text-sm border border-accent/30">
              unread only
              <a
                href={`/pins?${buildClearFilterUrl(searchParams, 'unread')}`}
                hx-get={`/pins/partial?${buildClearFilterUrl(searchParams, 'unread')}`}
                hx-target="#pin-list"
                hx-swap="innerHTML"
                hx-push-url={`/pins?${buildClearFilterUrl(searchParams, 'unread')}`}
                class="hover:text-destructive ml-1"
                aria-label="Remove unread filter"
              >
                ×
              </a>
            </span>
          )}

          <a
            href="/pins"
            hx-get="/pins/partial"
            hx-target="#pin-list"
            hx-swap="innerHTML"
            hx-push-url="/pins"
            class="text-sm text-muted-foreground hover:text-foreground hover:underline ml-2"
          >
            Clear all
          </a>
        </div>
      )}
    </div>
  )
}

export const PinsPage: FC<PinsPageProps> = ({
  pins,
  pagination,
  totalCount,
  searchParams = '',
  activeTag,
  searchQuery,
  readFilter = 'all',
  flash,
}) => {
  return (
    <BaseLayout title="Pins">
      <div class="min-h-screen">
        {/* Header */}
        <header class="border-b-2 border-foreground bg-background">
          <div class="max-w-4xl mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
              <h1 class="text-2xl font-bold">Pins</h1>
              <div class="flex items-center gap-4">
                <a
                  href="/pins/new"
                  class="px-4 py-2 bg-primary text-primary-foreground font-medium
                         border-2 border-foreground neobrutalism-shadow
                         hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                         active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                         transition-all"
                >
                  + New Pin
                </a>
                <a
                  href="/logout"
                  class="text-muted-foreground hover:text-foreground text-sm"
                >
                  Sign out
                </a>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main class="max-w-4xl mx-auto px-4 py-6">
          {/* Flash message */}
          {flash && (
            <div
              class={`mb-6 p-3 text-sm border-2 neobrutalism-shadow ${
                flash.type === 'success'
                  ? 'text-green-700 bg-green-50 border-green-200'
                  : flash.type === 'error'
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : flash.type === 'warning'
                      ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
                      : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}
            >
              {flash.message}
            </div>
          )}

          <FilterHeader
            activeTag={activeTag}
            searchQuery={searchQuery}
            readFilter={readFilter}
            searchParams={searchParams}
          />

          {/* Pin list - content loaded via server render, updates via HTMX */}
          <div id="pin-list">
            <PinListPartial
              pins={pins}
              pagination={pagination}
              totalCount={totalCount}
              searchParams={searchParams}
              viewSize="expanded"
            />
          </div>
        </main>
      </div>
    </BaseLayout>
  )
}
