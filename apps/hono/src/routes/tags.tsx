import { Hono } from 'hono'
import { AccessControl } from '@pinsquirrel/domain'
import { pinService, tagService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { TagsPage, type TagFilterType } from '../views/pages/tags'
import { TagMergePage } from '../views/pages/tag-merge'

const tags = new Hono()

// Apply auth middleware to all tag routes
tags.use('*', requireAuth())

// GET /tags - Show tags cloud page
tags.get('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)

  // Parse filter from URL
  const url = new URL(c.req.url)
  const unreadParam = url.searchParams.get('unread')

  // Determine current filter type
  const currentFilter: TagFilterType = unreadParam === 'true' ? 'toread' : 'all'

  // Build readLater filter if needed
  const readLaterFilter =
    currentFilter === 'toread' ? { readLater: true } : undefined

  // Clean up any tags with no pins before displaying
  await tagService.deleteTagsWithNoPins(ac, user.id)

  // Fetch tags with pin counts
  const userTags = await tagService.getUserTagsWithCount(
    ac,
    user.id,
    readLaterFilter
  )

  // Get count of untagged pins
  const untaggedResult = await pinService.getUserPinsWithPagination(
    ac,
    readLaterFilter ? { readLater: true, noTags: true } : { noTags: true },
    { pageSize: 1 } // Just need the count
  )

  // Get flash message if any
  const flash = sessionManager.getFlash()

  return c.html(
    <TagsPage
      user={user}
      tags={userTags}
      currentFilter={currentFilter}
      untaggedPinsCount={untaggedResult.totalCount}
      flash={flash}
    />
  )
})

// GET /tags/merge - Show tag merge page
tags.get('/merge', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)

  // Fetch all user's tags with pin counts
  const userTags = await tagService.getUserTagsWithCount(ac, user.id)

  // Filter to only tags with pins
  const tagsWithPins = userTags.filter((tag) => tag.pinCount > 0)

  // Get flash message if any
  const flash = sessionManager.getFlash()

  return c.html(<TagMergePage user={user} tags={tagsWithPins} flash={flash} />)
})

// POST /tags/merge - Perform tag merge
tags.post('/merge', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)

  // Parse form data
  const formData = await c.req.parseBody()

  // Helper to get string values
  const getString = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return getString(value[0])
    return ''
  }

  // Get source tag IDs (can be multiple checkboxes with same name)
  let sourceTagIds: string[] = []
  const sourceTagIdsRaw = formData['sourceTagIds']
  if (Array.isArray(sourceTagIdsRaw)) {
    sourceTagIds = sourceTagIdsRaw
      .map((v) => (typeof v === 'string' ? v : ''))
      .filter((v) => v.length > 0)
  } else if (typeof sourceTagIdsRaw === 'string' && sourceTagIdsRaw) {
    sourceTagIds = [sourceTagIdsRaw]
  }

  const destinationTagId = getString(formData['destinationTagId'])

  // Fetch tags for re-rendering on error
  const userTags = await tagService.getUserTagsWithCount(ac, user.id)
  const tagsWithPins = userTags.filter((tag) => tag.pinCount > 0)

  // Validation
  if (sourceTagIds.length === 0) {
    return c.html(
      <TagMergePage
        user={user}
        tags={tagsWithPins}
        errors={{ _form: ['Please select at least one source tag.'] }}
        selectedSourceTags={sourceTagIds}
        selectedDestinationTag={destinationTagId}
      />
    )
  }

  if (!destinationTagId) {
    return c.html(
      <TagMergePage
        user={user}
        tags={tagsWithPins}
        errors={{ _form: ['Please select a destination tag.'] }}
        selectedSourceTags={sourceTagIds}
        selectedDestinationTag={destinationTagId}
      />
    )
  }

  if (sourceTagIds.includes(destinationTagId)) {
    return c.html(
      <TagMergePage
        user={user}
        tags={tagsWithPins}
        errors={{
          _form: ['Destination tag cannot be one of the source tags.'],
        }}
        selectedSourceTags={sourceTagIds}
        selectedDestinationTag={destinationTagId}
      />
    )
  }

  try {
    // Perform the merge
    await tagService.mergeTags(ac, sourceTagIds, destinationTagId)

    // Redirect with success message
    sessionManager.setFlash('success', 'Tags merged successfully!')
    return c.redirect('/tags')
  } catch {
    return c.html(
      <TagMergePage
        user={user}
        tags={tagsWithPins}
        errors={{ _form: ['Failed to merge tags. Please try again.'] }}
        selectedSourceTags={sourceTagIds}
        selectedDestinationTag={destinationTagId}
      />,
      500
    )
  }
})

export { tags as tagsRoutes }
