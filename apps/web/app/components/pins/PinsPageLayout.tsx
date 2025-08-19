import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigation } from 'react-router'
import type { Pin } from '@pinsquirrel/core'
import { PinFilter } from './PinFilter'
import { PinList } from './PinList'
import { Button } from '~/components/ui/button'
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
  createPinPath: string // Path for Create Pin button
}

export function PinsPageLayout({
  pins,
  totalPages,
  currentPage,
  totalCount,
  username,
  successMessage,
  errorMessage,
  createPinPath,
}: PinsPageLayoutProps) {
  const navigation = useNavigation()

  // Client-side state for dismissing flash messages
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!successMessage)
  const [showErrorMessage, setShowErrorMessage] = useState(!!errorMessage)

  // Check if we're loading (navigating or submitting)
  const isLoading = navigation.state === 'loading'

  return (
    <div className="bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <PinFilter />
          <Button size="sm" asChild>
            <Link to={createPinPath}>
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Create Pin</span>
            </Link>
          </Button>
        </div>

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
        />
      </div>
    </div>
  )
}
