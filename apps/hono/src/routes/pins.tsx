import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  AccessControl,
  type PinFilter,
  type User,
  ValidationError,
  DuplicatePinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
} from '@pinsquirrel/domain'
import { pinService, tagService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { PinCard } from '../views/components/PinCard'
import { PinDeletePage } from '../views/pages/pin-delete'
import { PinEditPage } from '../views/pages/pin-edit'
import { PinNewPage } from '../views/pages/pin-new'
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

// GET /pins/new - Show pin creation form
pins.get('/new', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)

  // Get URL params for bookmarklet integration
  const url = new URL(c.req.url)
  const prefillUrl = url.searchParams.get('url') || ''
  const prefillTitle = url.searchParams.get('title') || ''
  const prefillDescription = url.searchParams.get('description') || ''
  const prefillTag = url.searchParams.get('tag') || ''

  // Check if URL already exists for this user (bookmarklet redirect to edit)
  if (prefillUrl) {
    const existingPins = await pinService.getUserPinsWithPagination(
      ac,
      { url: prefillUrl },
      { page: 1, pageSize: 1 }
    )

    if (existingPins.pins.length > 0) {
      // URL already exists, redirect to edit form
      return c.redirect(`/pins/${existingPins.pins[0].id}/edit`)
    }
  }

  // Fetch user's existing tags for display
  const userTags = await tagService.getUserTags(ac, user.id)

  // Get flash message if any
  const flash = sessionManager.getFlash()

  return c.html(
    <PinNewPage
      flash={flash}
      userTags={userTags.map((t) => t.name)}
      url={prefillUrl}
      title={prefillTitle}
      description={prefillDescription}
      tags={prefillTag}
    />
  )
})

// POST /pins/new - Create a new pin
pins.post('/new', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)

  // Parse form data
  const formData = await c.req.parseBody()

  // Helper to safely extract string from form data (handles File | string | array)
  const getString = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return getString(value[0])
    return ''
  }

  const pinUrl = getString(formData.url)
  const title = getString(formData.title)
  const description = getString(formData.description) || null
  const readLater = getString(formData.readLater) === 'true'
  const tagsInput = getString(formData.tags)

  // Parse tags from comma-separated string
  const tagNames = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  // Fetch user's tags for re-rendering form on error
  const userTags = await tagService.getUserTags(ac, user.id)

  try {
    // Create the pin using service
    await pinService.createPin(ac, {
      userId: user.id,
      url: pinUrl,
      title,
      description,
      readLater,
      tagNames,
    })

    // Redirect to pins list with success message
    sessionManager.setFlash('success', 'Pin created successfully!')
    return c.redirect('/pins')
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.html(
        <PinNewPage
          errors={error.fields}
          userTags={userTags.map((t) => t.name)}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          tags={tagsInput}
        />
      )
    }

    if (error instanceof DuplicatePinError) {
      return c.html(
        <PinNewPage
          errors={{ url: ['You have already saved this URL'] }}
          userTags={userTags.map((t) => t.name)}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          tags={tagsInput}
        />
      )
    }

    // Generic error
    return c.html(
      <PinNewPage
        errors={{ _form: ['Failed to create pin. Please try again.'] }}
        userTags={userTags.map((t) => t.name)}
        url={pinUrl}
        title={title}
        description={description || ''}
        readLater={readLater}
        tags={tagsInput}
      />,
      500
    )
  }
})

// GET /pins/:id/edit - Show pin edit form
pins.get('/:id/edit', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)

  try {
    // Fetch the pin and user's tags
    const [pin, userTags] = await Promise.all([
      pinService.getPin(ac, pinId),
      tagService.getUserTags(ac, user.id),
    ])

    // Get flash message if any
    const flash = sessionManager.getFlash()

    return c.html(
      <PinEditPage
        pin={pin}
        flash={flash}
        userTags={userTags.map((t) => t.name)}
      />
    )
  } catch (error) {
    if (
      error instanceof PinNotFoundError ||
      error instanceof UnauthorizedPinAccessError
    ) {
      return c.text('Pin not found', 404)
    }
    throw error
  }
})

// POST /pins/:id/edit - Update a pin
pins.post('/:id/edit', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)

  // Parse form data
  const formData = await c.req.parseBody()

  // Helper to safely extract string from form data
  const getString = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return getString(value[0])
    return ''
  }

  const pinUrl = getString(formData.url)
  const title = getString(formData.title)
  const description = getString(formData.description) || null
  const readLater = getString(formData.readLater) === 'true'
  const tagsInput = getString(formData.tags)

  // Parse tags from comma-separated string
  const tagNames = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  // Fetch user's tags for re-rendering form on error
  const userTags = await tagService.getUserTags(ac, user.id)

  try {
    // Get existing pin to get userId
    const existingPin = await pinService.getPin(ac, pinId)

    // Update the pin using service
    await pinService.updatePin(ac, {
      id: pinId,
      userId: existingPin.userId,
      url: pinUrl,
      title,
      description,
      readLater,
      tagNames,
    })

    // Redirect to pins list with success message
    sessionManager.setFlash('success', 'Pin updated successfully!')
    return c.redirect('/pins')
  } catch (error) {
    // Get the pin for re-rendering the form (may fail if not found)
    let pin
    try {
      pin = await pinService.getPin(ac, pinId)
    } catch {
      return c.text('Pin not found', 404)
    }

    if (error instanceof ValidationError) {
      return c.html(
        <PinEditPage
          pin={pin}
          errors={error.fields}
          userTags={userTags.map((t) => t.name)}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          tags={tagsInput}
        />
      )
    }

    if (error instanceof DuplicatePinError) {
      return c.html(
        <PinEditPage
          pin={pin}
          errors={{ url: ['You have already saved this URL'] }}
          userTags={userTags.map((t) => t.name)}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          tags={tagsInput}
        />
      )
    }

    if (
      error instanceof PinNotFoundError ||
      error instanceof UnauthorizedPinAccessError
    ) {
      return c.text('Pin not found', 404)
    }

    // Generic error
    return c.html(
      <PinEditPage
        pin={pin}
        errors={{ _form: ['Failed to update pin. Please try again.'] }}
        userTags={userTags.map((t) => t.name)}
        url={pinUrl}
        title={title}
        description={description || ''}
        readLater={readLater}
        tags={tagsInput}
      />,
      500
    )
  }
})

// POST /pins/:id/toggle-read - Toggle read later status (HTMX)
pins.post('/:id/toggle-read', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    c.header('HX-Redirect', '/signin')
    return c.body(null, 204)
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)

  // Get the current pin to toggle its status
  const existingPin = await pinService.getPin(ac, pinId)

  // Toggle the readLater status
  const updatedPin = await pinService.updatePin(ac, {
    id: existingPin.id,
    userId: existingPin.userId,
    url: existingPin.url,
    title: existingPin.title,
    description: existingPin.description,
    readLater: !existingPin.readLater,
    tagNames: existingPin.tagNames,
  })

  // Get search params from referer or request for preserving filters
  const referer = c.req.header('Referer') || ''
  let searchParams = ''
  try {
    const refererUrl = new URL(referer)
    searchParams = refererUrl.search.replace(/^\?/, '')
  } catch {
    // Ignore invalid referer
  }

  // Return updated PinCard for HTMX to swap
  return c.html(
    <PinCard pin={updatedPin} viewSize="expanded" searchParams={searchParams} />
  )
})

// GET /pins/:id/delete - Show delete confirmation
pins.get('/:id/delete', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)

  try {
    const pin = await pinService.getPin(ac, pinId)

    return c.html(<PinDeletePage pin={pin} />)
  } catch (error) {
    if (
      error instanceof PinNotFoundError ||
      error instanceof UnauthorizedPinAccessError
    ) {
      return c.text('Pin not found', 404)
    }
    throw error
  }
})

// POST /pins/:id/delete - Delete a pin
pins.post('/:id/delete', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)

  try {
    await pinService.deletePin(ac, pinId)

    sessionManager.setFlash('success', 'Pin deleted successfully!')
    return c.redirect('/pins')
  } catch (error) {
    if (
      error instanceof PinNotFoundError ||
      error instanceof UnauthorizedPinAccessError
    ) {
      return c.text('Pin not found', 404)
    }
    throw error
  }
})

export { pins as pinsRoutes }
