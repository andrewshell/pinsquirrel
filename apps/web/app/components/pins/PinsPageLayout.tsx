import { Suspense, useState, use } from 'react'
import type { Pin } from '@pinsquirrel/domain'
import { PinList } from './PinList'
import { FilterHeader, type ReadFilterType } from './FilterHeader'
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
  username: string
  successMessage: string | null
  errorMessage: string | null
  activeTag?: string
  currentFilter?: ReadFilterType
  noTags?: boolean
  searchParams: URLSearchParams
}

function PinsContent({
  pinsData,
  username,
  searchParams,
}: {
  pinsData: Promise<PinsResult>
  username: string
  searchParams: URLSearchParams
}) {
  const result = use(pinsData)

  return (
    <>
      <PinList pins={result.pins} isLoading={false} username={username} />
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
  username,
  successMessage,
  errorMessage,
  activeTag,
  currentFilter = 'all',
  noTags = false,
  searchParams,
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
          username={username}
          searchParams={searchParams}
        />
      </Suspense>
    </>
  )
}
