import { calculatePagination, parsePaginationParams } from '@pinsquirrel/core'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, data, useLoaderData, useNavigation, Outlet } from 'react-router'
import { PinFilter } from '~/components/pins/PinFilter'
import { PinList } from '~/components/pins/PinList'
import { Button } from '~/components/ui/button'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { PinsPagination } from '~/components/ui/pins-pagination'
import { repositories } from '~/lib/services/container.server'
import { commitSession, getSession, requireUser } from '~/lib/session.server'
import { requireUsernameMatch } from '~/lib/auth.server'
import type { Route } from './+types/pins'

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url)

  // Parse pagination parameters from URL
  const paginationParams = parsePaginationParams({
    page: url.searchParams.get('page') || undefined,
    pageSize: url.searchParams.get('pageSize') || undefined,
  })

  // Parse filter parameter from URL
  const filterParam = url.searchParams.get('filter')
  const currentFilter = filterParam === 'toread' ? 'toread' : 'all'

  // Build filter object for repository
  const filter: { readLater?: boolean } = {}
  if (currentFilter === 'toread') {
    filter.readLater = true
  }

  // Get authenticated user and validate username match
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Get session for flash messages
  const session = await getSession(request)

  // Check for flash messages (these are automatically removed when accessed)
  const successMessage = session.get('flash-success') as string | null
  const errorMessage = session.get('flash-error') as string | null

  // Get total count for pagination calculation with filter
  const totalCount = await repositories.pin.countByUserIdWithFilter(
    user.id,
    filter
  )

  // Calculate pagination details
  const pagination = calculatePagination(totalCount, {
    ...paginationParams,
    defaultPageSize: 25,
    maxPageSize: 100,
  })

  // Fetch pins with pagination and filter
  const pins = await repositories.pin.findByUserIdWithFilter(user.id, filter, {
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
      currentFilter,
      username: user.username,
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
    username,
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
    <div className="bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <PinFilter />
          <Button size="sm" asChild>
            <Link to="new">
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

      {/* Nested routes render here as modals */}
      <Outlet />
    </div>
  )
}
