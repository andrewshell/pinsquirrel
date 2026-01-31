import { Hono } from 'hono'
import { AccessControl } from '@pinsquirrel/domain'
import { pinService, tagService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { TagsPage, type TagFilterType } from '../views/pages/tags'

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
      tags={userTags}
      currentFilter={currentFilter}
      untaggedPinsCount={untaggedResult.totalCount}
      flash={flash}
    />
  )
})

export { tags as tagsRoutes }
