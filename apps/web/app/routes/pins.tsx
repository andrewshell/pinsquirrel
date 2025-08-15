import { useLoaderData, useNavigation, Link, data } from 'react-router'
import { useState } from 'react'
import type { Route } from './+types/pins'
import { requireUser, getSession, commitSession } from '~/lib/session.server'
import { repositories } from '~/lib/services/container.server'
import { parsePaginationParams, calculatePagination } from '@pinsquirrel/core'
import { PinList } from '~/components/pins/PinList'
import { PinsPagination } from '~/components/ui/pins-pagination'
import { Button } from '~/components/ui/button'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { Plus } from 'lucide-react'

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)

  // Parse pagination parameters from URL
  const paginationParams = parsePaginationParams({
    page: url.searchParams.get('page') || undefined,
    pageSize: url.searchParams.get('pageSize') || undefined,
  })

  // Get authenticated user
  const user = await requireUser(request)

  // Get session for flash messages
  const session = await getSession(request)

  // Check for flash messages (these are automatically removed when accessed)
  const successMessage = session.get('flash-success') as string | null
  const errorMessage = session.get('flash-error') as string | null

  // Get total count for pagination calculation
  const totalCount = await repositories.pin.countByUserId(user.id)

  // Calculate pagination details
  const pagination = calculatePagination(totalCount, {
    ...paginationParams,
    defaultPageSize: 25,
    maxPageSize: 100,
  })

  // Fetch pins with pagination
  const pins = await repositories.pin.findByUserId(user.id, {
    limit: pagination.pageSize,
    offset: pagination.offset,
  })

  // Return with updated session to clear flash messages
  return data(
    {
      pins,
      totalPages: pagination.totalPages,
      currentPage: pagination.page,
      totalCount,
      successMessage,
      errorMessage,
    },
    {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    }
  )
}

export default function PinsPage() {
  const {
    pins,
    totalPages,
    currentPage,
    totalCount,
    successMessage,
    errorMessage,
  } = useLoaderData<typeof loader>()
  const navigation = useNavigation()

  // Client-side state for dismissing flash messages
  const [showSuccessMessage, setShowSuccessMessage] = useState(!!successMessage)
  const [showErrorMessage, setShowErrorMessage] = useState(!!errorMessage)

  // Check if we're loading (navigating or submitting)
  const isLoading = navigation.state === 'loading'

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Pins</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your saved bookmarks, images, and articles
            </p>
          </div>
          <Button asChild>
            <Link to="/pins/new">
              <Plus className="h-4 w-4 mr-2" />
              Create Pin
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

        <PinList pins={pins} isLoading={isLoading} />

        <PinsPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </div>
    </div>
  )
}
