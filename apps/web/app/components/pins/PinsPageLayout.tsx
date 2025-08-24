import { useState } from 'react'
import { useNavigation } from 'react-router'
import type { Pin } from '@pinsquirrel/core'
import { PinList } from './PinList'
import { FilterHeader, type ReadFilterType } from './FilterHeader'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { PinsPagination } from '~/components/ui/pins-pagination'

interface PinsPageLayoutProps {
  pins: Pin[]
  totalPages: number
  currentPage: number
  totalCount: number
  username: string
  successMessage: string | null
  errorMessage: string | null
  activeTag?: string // Current tag filter
  currentFilter?: ReadFilterType // Current read filter
  noTags?: boolean // No tags filter
  searchParams: URLSearchParams
}

export function PinsPageLayout({
  pins,
  totalPages,
  currentPage,
  totalCount,
  username,
  successMessage,
  errorMessage,
  activeTag,
  currentFilter = 'all',
  noTags = false,
  searchParams,
}: PinsPageLayoutProps) {
  const navigation = useNavigation()

  // Client-side state for dismissing flash messages
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!successMessage)
  const [showErrorMessage, setShowErrorMessage] = useState(!!errorMessage)

  // Check if we're loading (navigating or submitting)
  const isLoading = navigation.state === 'loading'

  // Get current search query
  const currentSearch = searchParams.get('search') || ''

  return (
    <>
      <FilterHeader
        activeTag={activeTag}
        searchQuery={currentSearch}
        resultCount={totalCount}
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

      <PinList pins={pins} isLoading={isLoading} username={username} />

      <PinsPagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        searchParams={searchParams}
      />
    </>
  )
}
