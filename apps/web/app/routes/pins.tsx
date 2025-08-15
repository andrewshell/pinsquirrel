import { useLoaderData, useNavigation, Link, data } from 'react-router'
import { useState } from 'react'
import type { Route } from './+types/pins'
import { requireUser, getSession, commitSession } from '~/lib/session.server'
import {
  DrizzlePinRepository,
  DrizzleTagRepository,
  db,
} from '@pinsquirrel/database'
import { PinList } from '~/components/pins/PinList'
import { PinsPagination } from '~/components/ui/pins-pagination'
import { Button } from '~/components/ui/button'
import { DismissibleAlert } from '~/components/ui/dismissible-alert'
import { Plus } from 'lucide-react'

// Server-side repositories
const tagRepository = new DrizzleTagRepository(db)
const pinRepository = new DrizzlePinRepository(db, tagRepository)

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
  const pageSize = 25

  // Get authenticated user
  const user = await requireUser(request)

  // Get session for flash messages
  const session = await getSession(request)

  // Check for flash messages (these are automatically removed when accessed)
  const successMessage = session.get('flash-success') as string | null
  const errorMessage = session.get('flash-error') as string | null

  // Fetch pins with pagination
  const offset = (page - 1) * pageSize
  const pins = await pinRepository.findByUserId(user.id, {
    limit: pageSize,
    offset: offset,
  })

  // Get total count for pagination
  const totalCount = await pinRepository.countByUserId(user.id)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  // Return with updated session to clear flash messages
  return data(
    {
      pins,
      totalPages,
      currentPage: page,
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
