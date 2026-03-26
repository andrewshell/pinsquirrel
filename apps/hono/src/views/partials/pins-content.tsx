import type { FC } from 'hono/jsx'
import type { Pin, Pagination } from '@pinsquirrel/domain'
import { FilterHeader } from '../components/FilterHeader'
import { ViewSettings } from '../components/ViewSettings'
import { PinListPartial } from './pin-list'

interface PinsContentPartialProps {
  pins: Pin[]
  pagination: Pagination
  totalCount: number
  searchParams: string
  activeTag?: string
  searchQuery?: string
  readFilter?: 'all' | 'unread' | 'read'
  viewSize?: 'expanded' | 'compact'
  sortBy?: 'created' | 'title'
  sortDirection?: 'asc' | 'desc'
  noTags?: boolean
}

export const PinsContentPartial: FC<PinsContentPartialProps> = ({
  pins,
  pagination,
  totalCount,
  searchParams,
  activeTag,
  searchQuery,
  readFilter = 'all',
  viewSize = 'expanded',
  sortBy = 'created',
  sortDirection = 'desc',
  noTags = false,
}) => {
  return (
    <>
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

      <div id="pin-list">
        <PinListPartial
          pins={pins}
          pagination={pagination}
          totalCount={totalCount}
          searchParams={searchParams}
          viewSize={viewSize}
        />
      </div>
    </>
  )
}
