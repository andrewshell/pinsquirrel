import { useLoaderData } from 'react-router'
import { repositories } from '~/lib/services/container.server'
import { requireUser } from '~/lib/session.server'
import { requireUsernameMatch } from '~/lib/auth.server'
import { TagCloud } from '~/components/tags/TagCloud'
import { TagFilter, type TagFilterType } from '~/components/tags/TagFilter'
import type { Route } from './+types/tags'

export function meta({ params }: Route.MetaArgs) {
  return [
    {
      title: `${params.username}'s Tags - PinSquirrel`,
    },
    {
      name: 'description',
      content: 'Browse all your tags organized by usage on PinSquirrel.',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  // Get authenticated user and validate username match
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Parse filter from URL search params
  const url = new URL(request.url)
  const filterParam = url.searchParams.get('filter') || 'all'

  // Create filter object based on parameter
  const filter: { readLater?: boolean } = {}
  if (filterParam === 'toread') {
    filter.readLater = true
  }
  // If 'all' or any other value, no filter is applied

  // Fetch tags with pin counts
  const tags = await repositories.tag.findByUserIdWithPinCount(
    user.id,
    Object.keys(filter).length > 0 ? filter : undefined
  )

  return {
    tags,
    username: user.username,
    currentFilter: filterParam as TagFilterType,
  }
}

export default function TagsPage() {
  const { tags, username, currentFilter } = useLoaderData<typeof loader>()

  return (
    <div className="bg-background py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex justify-between items-center">
          <TagFilter currentFilter={currentFilter} username={username} />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {username}&apos;s Tags
          </h1>
          <p className="text-muted-foreground">
            {tags.length === 0
              ? 'No tags yet. Tags will appear here when you add them to your pins.'
              : `${tags.length} tag${tags.length === 1 ? '' : 's'} total`}
          </p>
        </div>

        {tags.length > 0 ? (
          <TagCloud tags={tags} username={username} />
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t created any tags yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Tags help organize your pins. Add some tags to your pins to see
              them here!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
