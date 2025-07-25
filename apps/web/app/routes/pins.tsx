import { useLoaderData } from 'react-router'
import type { Route } from './+types/pins'
import { requireUser } from '~/lib/session.server'
import { DrizzlePinRepository, DrizzleTagRepository, db } from '@pinsquirrel/database'
import { EmptyState } from '~/components/pins/EmptyState'
import { PinCard } from '~/components/pins/PinCard'
import type { Pin } from '@pinsquirrel/core'

// Server-side repositories
const tagRepository = new DrizzleTagRepository(db)
const _pinRepository = new DrizzlePinRepository(db, tagRepository)

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url)
  const page = Number(url.searchParams.get('page')) || 1
  const _pageSize = 25

  // Get authenticated user
  const _user = await requireUser(request)

  // For now, return empty data structure
  // Full implementation will come in Task 2
  return {
    pins: [] as Pin[],
    totalPages: 1,
    currentPage: page,
    totalCount: 0,
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