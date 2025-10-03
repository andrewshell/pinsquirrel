import { Suspense, useState, use } from 'react'
import type { Pin } from '@pinsquirrel/domain'
import { PinList } from './PinList'
import { FilterHeader, type ReadFilterType } from './FilterHeader'
import { ViewSettings } from './ViewSettings'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { PinsPagination } from '~/components/ui/pins-pagination'

interface PinsResult {
  pins: Pin[]
  pagination: {
    page: number
    totalPages: number
  }
  totalCount: number
}

interface PinsPageLayoutProps {
  pinsData: Promise<PinsResult>
  successMessage: string | null
  errorMessage: string | null
  activeTag?: string
  currentFilter?: ReadFilterType
  noTags?: boolean
  searchParams: URLSearchParams
  viewSettings: {
    sort: 'created' | 'title'
    direction: 'asc' | 'desc'
    size: 'expanded' | 'compact'
  }
}

function PinsContent({
  pinsData,
  searchParams,
  viewSize,
}: {
  pinsData: Promise<PinsResult>
  searchParams: URLSearchParams
  viewSize: 'expanded' | 'compact'
}) {
  const result = use(pinsData)

  return (
    <>
      <PinList pins={result.pins} isLoading={false} viewSize={viewSize} />
      <PinsPagination
        currentPage={result.pagination.page}
        totalPages={result.pagination.totalPages}
        totalCount={result.totalCount}
        searchParams={searchParams}
      />
    </>
  )
}

export function PinsPageLayout({
  pinsData,
  successMessage,
  errorMessage,
  activeTag,
  currentFilter = 'all',
  noTags = false,
  searchParams,
  viewSettings,
}: PinsPageLayoutProps) {
  // Client-side state for dismissing flash messages
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!successMessage)
  const [showErrorMessage, setShowErrorMessage] = useState(!!errorMessage)

  // Get current search query
  const currentSearch = searchParams.get('search') || ''

  return (
    <>
      <FilterHeader
        activeTag={activeTag}
        searchQuery={currentSearch}
        currentFilter={currentFilter}
        noTags={noTags}
        className="mb-0"
      />

      <ViewSettings
        sort={viewSettings.sort}
        direction={viewSettings.direction}
        size={viewSettings.size}
        className="mb-6"
      />

      {successMessage && (
        <DismissibleAlert
          message={successMessage}
          type="success"
          show={showSuccessMessage}
          onDismiss={() => setShowSuccessMessage(false)}
          className="mb-6"
        />
      )}

      {errorMessage && (
        <DismissibleAlert
          message={errorMessage}
          type="error"
          show={showErrorMessage}
          onDismiss={() => setShowErrorMessage(false)}
          className="mb-6"
        />
      )}

      <Suspense fallback={<></>}>
        <PinsContent
          pinsData={pinsData}
          searchParams={searchParams}
          viewSize={viewSettings.size}
        />
      </Suspense>
    </>
  )
}
