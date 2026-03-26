import type { FC } from 'hono/jsx'
import type { Pin, Pagination, User } from '@pinsquirrel/domain'
import { DefaultLayout } from '../layouts/default'
import { PinsContentPartial } from '../partials/pins-content'
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
    <DefaultLayout title="Pins" user={user} currentPath="/pins">
      {/* Flash message */}
      {flash && (
        <FlashMessage
          type={flash.type}
          message={flash.message}
          className="mb-6"
        />
      )}

      <h1 class="sr-only">Pins</h1>
      <div id="pins-content">
        <PinsContentPartial
          pins={pins}
          pagination={pagination}
          totalCount={totalCount}
          searchParams={searchParams}
          activeTag={activeTag}
          searchQuery={searchQuery}
          readFilter={readFilter}
          viewSize={viewSize}
          sortBy={sortBy}
          sortDirection={sortDirection}
          noTags={noTags}
        />
      </div>
    </DefaultLayout>
  )
}
