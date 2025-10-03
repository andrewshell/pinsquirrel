import { useLoaderData } from 'react-router'
import { pinService, tagService } from '~/lib/services/container.server'
import { requireAccessControl } from '~/lib/session.server'
import { TagCloud } from '~/components/tags/TagCloud'
import { TagFilter, type TagFilterType } from '~/components/tags/TagFilter'
import { parsePinFilters } from '~/lib/filter-utils.server'
import { Button } from '~/components/ui/button'
import { Merge } from 'lucide-react'
import { Link } from 'react-router'
import type { Route } from './+types/tags'

export function meta(_: Route.MetaArgs) {
  return [
    {
      title: 'Tags - PinSquirrel',
    },
    {
      name: 'description',
      content: 'Browse all your tags organized by usage on PinSquirrel.',
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  // Get access control
  const ac = await requireAccessControl(request)

  // Parse filter from URL search params using centralized utility
  const url = new URL(request.url)
  const parsedFilters = parsePinFilters(url)

  // Clean up any tags with no pins before displaying
  await tagService.deleteTagsWithNoPins(ac, ac.user!.id)

  // Fetch tags with pin counts, only pass filter if there are readLater constraints
  const tags = await tagService.getUserTagsWithCount(
    ac,
    ac.user!.id,
    parsedFilters.filter.readLater !== undefined
      ? { readLater: parsedFilters.filter.readLater }
      : undefined
  )

  // Get count of untagged pins using the pin service pagination method
  const untaggedResult = await pinService.getUserPinsWithPagination(
    ac,
    parsedFilters.filter.readLater !== undefined
      ? { readLater: parsedFilters.filter.readLater, noTags: true }
      : { noTags: true },
    { pageSize: 1 } // Just need the count
  )

  return {
    tags,
    currentFilter: parsedFilters.currentFilterType as TagFilterType,
    untaggedPinsCount: untaggedResult.totalCount,
  }
}

export default function TagsPage() {
  const { tags, currentFilter, untaggedPinsCount } =
    useLoaderData<typeof loader>()

  return (
    <>
      <div className="mb-8 flex justify-between items-center">
        <TagFilter currentFilter={currentFilter} />
        {tags.length > 1 && (
          <Button size="sm" asChild>
            <Link to="/tags/merge">
              <Merge className="h-4 w-4 mr-2" />
              Merge Tags
            </Link>
          </Button>
        )}
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Tags</h1>
        <p className="text-muted-foreground">
          {tags.length === 0
            ? 'No tags yet. Tags will appear here when you add them to your pins.'
            : `${tags.length} tag${tags.length === 1 ? '' : 's'} total`}
        </p>
      </div>

      {tags.length > 0 || untaggedPinsCount > 0 ? (
        <TagCloud
          tags={tags}
          currentFilter={currentFilter}
          untaggedPinsCount={untaggedPinsCount}
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t created any tags yet.
          </p>
          <p className="text-sm text-muted-foreground">
            Tags help organize your pins. Add some tags to your pins to see them
            here!
          </p>
        </div>
      )}
    </>
  )
}
