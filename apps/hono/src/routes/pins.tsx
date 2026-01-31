import { Hono } from 'hono'
import type { Context } from 'hono'
import { AccessControl, type PinFilter, type User } from '@pinsquirrel/domain'
import { pinService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { PinsPage } from '../views/pages/pins'
import { PinListPartial } from '../views/partials/pin-list'

const pins = new Hono()

// Apply auth middleware to all pin routes
pins.use('*', requireAuth())

// Helper to parse pin query parameters
function parsePinQueryParams(c: Context) {
  const url = new URL(c.req.url)
  const tag = url.searchParams.get('tag') || undefined
  const search = url.searchParams.get('search') || undefined
  const unreadParam = url.searchParams.get('unread')
  const pageParam = url.searchParams.get('page')
  const sizeParam = url.searchParams.get('size')

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

  // Parse view size
  const viewSize: 'expanded' | 'compact' =
    sizeParam === 'compact' ? 'compact' : 'expanded'

  // Build search params string for preserving filters (exclude page for base params)
  const searchParams = url.search.replace(/^\?/, '')

  return {
    tag,
    search,
    readFilter,
    filter,
    page,
    viewSize,
    searchParams,
  }
}

// Helper to fetch pins for a user
async function fetchUserPins(user: User, filter: PinFilter, page: number) {
  const ac = new AccessControl(user)
  return pinService.getUserPinsWithPagination(ac, filter, {
    page,
    pageSize: 25,
  })
}

// GET /pins - List all pins with filtering and pagination (full page)
pins.get('/', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const { tag, search, readFilter, filter, page, searchParams } =
    parsePinQueryParams(c)

  const result = await fetchUserPins(user, filter, page)

  // Get flash message if any
  const flash = sessionManager.getFlash()

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

// GET /pins/partial - Return just the pin list HTML for HTMX
pins.get('/partial', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    // For HTMX requests, return a redirect indicator
    c.header('HX-Redirect', '/signin')
    return c.body(null, 204)
  }

  const { filter, page, viewSize, searchParams } = parsePinQueryParams(c)

  const result = await fetchUserPins(user, filter, page)

  return c.html(
    <PinListPartial
      pins={result.pins}
      pagination={result.pagination}
      totalCount={result.totalCount}
      searchParams={searchParams}
      viewSize={viewSize}
    />
  )
})

export { pins as pinsRoutes }
