import { useLoaderData, useNavigation, Link } from 'react-router'
import type { Route } from './+types/pins'
import { requireUser } from '~/lib/session.server'
import { DrizzlePinRepository, DrizzleTagRepository, db } from '@pinsquirrel/database'
import { PinList } from '~/components/pins/PinList'
import { Pagination } from '~/components/pins/Pagination'
import { Button } from '~/components/ui/button'
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

  // Fetch pins with pagination
  const offset = (page - 1) * pageSize
  const pins = await pinRepository.findByUserId(user.id, {
    limit: pageSize,
    offset: offset,
  })

  // Get total count for pagination
  const totalCount = await pinRepository.countByUserId(user.id)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    pins,
    totalPages,
    currentPage: page,
    totalCount,
  }
}

export default function PinsPage() {
  const { pins, totalPages, currentPage, totalCount } = useLoaderData<typeof loader>()
  const navigation = useNavigation()
  
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

        <PinList pins={pins} isLoading={isLoading} />
        
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </div>
    </div>
  )
}