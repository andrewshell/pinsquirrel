import type { FC } from 'hono/jsx'
import type { Pin, Pagination } from '@pinsquirrel/domain'
import { PinCard } from '../components/PinCard'

interface PinListPartialProps {
  pins: Pin[]
  pagination: Pagination
  totalCount: number
  searchParams: string
  viewSize?: 'expanded' | 'compact'
}

// Build pagination URL
function buildPageUrl(page: number, currentParams: string): string {
  const params = new URLSearchParams(currentParams)
  params.set('page', String(page))
  return `/pins/partial?${params.toString()}`
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
            hx-get={buildPageUrl(pagination.page - 1, searchParams)}
            hx-target="#pin-list"
            hx-swap="innerHTML"
            hx-push-url={`/pins?${new URLSearchParams(searchParams).toString()}&page=${pagination.page - 1}`}
            class="px-3 py-1 text-sm font-medium border-2 border-foreground bg-background
                   hover:bg-accent/10 transition-colors"
          >
            ← Previous
          </a>
        )}

        {pagination.hasNext && (
          <a
            href={buildPageUrl(pagination.page + 1, searchParams)}
            hx-get={buildPageUrl(pagination.page + 1, searchParams)}
            hx-target="#pin-list"
            hx-swap="innerHTML"
            hx-push-url={`/pins?${new URLSearchParams(searchParams).toString()}&page=${pagination.page + 1}`}
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

export const PinListPartial: FC<PinListPartialProps> = ({
  pins,
  pagination,
  totalCount,
  searchParams,
  viewSize = 'expanded',
}) => {
  // Determine if there are active filters by checking searchParams
  const params = new URLSearchParams(searchParams)
  const hasFilters =
    params.has('tag') ||
    params.has('search') ||
    params.get('unread') === 'true' ||
    params.get('unread') === 'false'

  return (
    <>
      {pins.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : (
        <div class={viewSize === 'compact' ? 'space-y-1' : 'space-y-4'}>
          {pins.map((pin) => (
            <PinCard
              pin={pin}
              viewSize={viewSize}
              searchParams={searchParams}
            />
          ))}
        </div>
      )}

      <PaginationControls
        pagination={pagination}
        totalCount={totalCount}
        searchParams={searchParams}
      />
    </>
  )
}
