import { Hono } from 'hono'
import { AccessControl, type PinFilter } from '@pinsquirrel/domain'
import { pinService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { PinsPage } from '../views/pages/pins'

const pins = new Hono()

// Apply auth middleware to all pin routes
pins.use('*', requireAuth())

// GET /pins - List all pins with filtering and pagination
pins.get('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  // Parse query parameters
  const url = new URL(c.req.url)
  const tag = url.searchParams.get('tag') || undefined
  const search = url.searchParams.get('search') || undefined
  const unreadParam = url.searchParams.get('unread')
  const pageParam = url.searchParams.get('page')

  // Build filter
  const filter: PinFilter = {}

  if (tag) {
    filter.tag = tag
  }

  if (search) {
    filter.search = search
  }

  // Handle unread filter
  let readFilter: 'all' | 'unread' | 'read' = 'all'
  if (unreadParam === 'true') {
    filter.readLater = true
    readFilter = 'unread'
  } else if (unreadParam === 'false') {
    filter.readLater = false
    readFilter = 'read'
  }

  // Parse page number
  const page = pageParam ? parseInt(pageParam, 10) : 1

  // Create access control for the user
  const ac = new AccessControl(user)

  // Fetch pins with pagination
  const result = await pinService.getUserPinsWithPagination(ac, filter, {
    page,
    pageSize: 25,
  })

  // Get flash message if any
  const flash = sessionManager.getFlash()

  // Build search params string for preserving filters
  const searchParams = url.search.replace(/^\?/, '')

  return c.html(
    <PinsPage
      pins={result.pins}
      pagination={result.pagination}
      totalCount={result.totalCount}
      searchParams={searchParams}
      activeTag={tag}
      searchQuery={search}
      readFilter={readFilter}
      flash={flash}
    />
  )
})

export { pins as pinsRoutes }
