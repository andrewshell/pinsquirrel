import { useLoaderData } from 'react-router'
import type { Route } from './+types/pins'
import { requireUser } from '~/lib/session.server'
import { DrizzlePinRepository, DrizzleTagRepository, db } from '@pinsquirrel/database'
import { EmptyState } from '~/components/pins/EmptyState'
import { PinCard } from '~/components/pins/PinCard'

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
  const { pins, totalPages: _totalPages, currentPage: _currentPage, totalCount: _totalCount } = useLoaderData<typeof loader>()

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">My Pins</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your saved bookmarks, images, and articles
          </p>
        </div>

        {pins.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pins.map((pin) => (
              <PinCard key={pin.id} pin={pin} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}