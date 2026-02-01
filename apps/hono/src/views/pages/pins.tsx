import type { FC } from 'hono/jsx'
import type { Pin, Pagination, User } from '@pinsquirrel/domain'
import { BaseLayout } from '../layouts/base'
import { PinListPartial } from '../partials/pin-list'
import { Header } from '../components/Header'
import { FilterHeader } from '../components/FilterHeader'
import { ViewSettings } from '../components/ViewSettings'
import { FlashMessage } from '../components/FlashMessage'
import type { FlashType } from '../../middleware/session'

interface PinsPageProps {
  user: User
  pins: Pin[]
  pagination: Pagination
  totalCount: number
  searchParams?: string
  activeTag?: string
  searchQuery?: string
  readFilter?: 'all' | 'unread' | 'read'
  viewSize?: 'expanded' | 'compact'
  sortBy?: 'created' | 'title'
  sortDirection?: 'asc' | 'desc'
  noTags?: boolean
  flash?: { type: FlashType; message: string } | null
}

export const PinsPage: FC<PinsPageProps> = ({
  user,
  pins,
  pagination,
  totalCount,
  searchParams = '',
  activeTag,
  searchQuery,
  readFilter = 'all',
  viewSize = 'expanded',
  sortBy = 'created',
  sortDirection = 'desc',
  noTags = false,
  flash,
}) => {
  return (
    <BaseLayout title="Pins">
      <div class="min-h-screen">
        {/* Global Header */}
        <Header user={user} currentPath="/pins" />

        {/* Main content */}
        <main class="max-w-4xl mx-auto px-4 py-6">
          {/* Flash message */}
          {flash && (
            <FlashMessage
              type={flash.type}
              message={flash.message}
              className="mb-6"
            />
          )}

          <FilterHeader
            activeTag={activeTag}
            searchQuery={searchQuery}
            readFilter={readFilter}
            searchParams={searchParams}
            noTags={noTags}
          />

          <ViewSettings
            sortBy={sortBy}
            sortDirection={sortDirection}
            viewSize={viewSize}
            searchParams={searchParams}
          />

          {/* Pin list - content loaded via server render, updates via HTMX */}
          <div id="pin-list">
            <PinListPartial
              pins={pins}
              pagination={pagination}
              totalCount={totalCount}
              searchParams={searchParams}
              viewSize={viewSize}
            />
          </div>
        </main>
      </div>
    </BaseLayout>
  )
}
