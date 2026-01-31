import type { FC } from 'hono/jsx'
import type { Pin, Pagination } from '@pinsquirrel/domain'
import { BaseLayout } from '../layouts/base'
import { PinCard } from '../components/PinCard'
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

// Build pagination URL
function buildPageUrl(page: number, currentParams: string): string {
  const params = new URLSearchParams(currentParams)
  params.set('page', String(page))
  return `/pins?${params.toString()}`
}

// Build filter clear URL
function buildClearFilterUrl(
  currentParams: string,
  filterToRemove: 'tag' | 'search' | 'unread'
): string {
  const params = new URLSearchParams(currentParams)
  params.delete(filterToRemove)
  params.delete('page') // Reset to page 1 when changing filters
  return `/pins?${params.toString()}`
}

const EmptyState: FC<{ hasFilters: boolean }> = ({ hasFilters }) => {
  if (hasFilters) {
    return (
      <div class="text-center py-12">
        <p class="text-muted-foreground text-lg mb-4">
          No pins match your current filters.
        </p>
        <a
          href="/pins"
          class="text-accent hover:text-accent/80 hover:underline font-medium"
        >
          Clear all filters
        </a>
      </div>
    )
  }

  return (
    <div class="text-center py-12">
      <p class="text-muted-foreground text-lg mb-4">
        You haven't saved any pins yet.
      </p>
      <a
        href="/pins/new"
        class="inline-block px-6 py-3 bg-primary text-primary-foreground font-medium
               border-2 border-foreground neobrutalism-shadow
               hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
               active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
               transition-all"
      >
        Add your first pin
      </a>
    </div>
  )
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

  return (
    <div class="mb-6">
      {/* Search bar */}
      <div class="mb-4">
        <form method="get" action="/pins" class="flex gap-2">
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
                href={buildClearFilterUrl(searchParams, 'tag')}
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
                href={buildClearFilterUrl(searchParams, 'search')}
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
                href={buildClearFilterUrl(searchParams, 'unread')}
                class="hover:text-destructive ml-1"
                aria-label="Remove unread filter"
              >
                ×
              </a>
            </span>
          )}

          <a
            href="/pins"
            class="text-sm text-muted-foreground hover:text-foreground hover:underline ml-2"
          >
            Clear all
          </a>
        </div>
      )}
    </div>
  )
}

const PaginationControls: FC<{
  pagination: Pagination
  totalCount: number
  searchParams: string
}> = ({ pagination, totalCount, searchParams }) => {
  if (pagination.totalPages <= 1) return null

  return (
    <div class="flex items-center justify-between mt-8 pt-4 border-t border-foreground/20">
      <div class="text-sm text-muted-foreground">
        Showing page {pagination.page} of {pagination.totalPages} ({totalCount}{' '}
        total pins)
      </div>

      <div class="flex gap-2">
        {pagination.hasPrevious && (
          <a
            href={buildPageUrl(pagination.page - 1, searchParams)}
            class="px-3 py-1 text-sm font-medium border-2 border-foreground bg-background
                   hover:bg-accent/10 transition-colors"
          >
            ← Previous
          </a>
        )}

        {pagination.hasNext && (
          <a
            href={buildPageUrl(pagination.page + 1, searchParams)}
            class="px-3 py-1 text-sm font-medium border-2 border-foreground bg-background
                   hover:bg-accent/10 transition-colors"
          >
            Next →
          </a>
        )}
      </div>
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
  const hasFilters: boolean =
    !!activeTag ||
    !!searchQuery ||
    (readFilter !== undefined && readFilter !== 'all')

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

          {/* Pin list */}
          <div id="pin-list">
            {pins.length === 0 ? (
              <EmptyState hasFilters={hasFilters} />
            ) : (
              <div class="space-y-4">
                {pins.map((pin) => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    viewSize="expanded"
                    searchParams={searchParams}
                  />
                ))}
              </div>
            )}
          </div>

          <PaginationControls
            pagination={pagination}
            totalCount={totalCount}
            searchParams={searchParams}
          />
        </main>
      </div>
    </BaseLayout>
  )
}
