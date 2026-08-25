/**
 * The pin CRUD routes, shared by the public list at `/pins` and the private one
 * at `/private/pins`.
 *
 * The two used to be separate files with 558 identical lines between them. They
 * differ in only a handful of places, all of them options on `createPinRoutes`:
 * which links get generated, whether the list is filtered to private pins,
 * whether a new pin is forced private, and whether the pages render the private
 * chrome. Everything else is one implementation.
 */
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
import { parsePinForm } from '../lib/form'
import { getAuthUser, getSessionManager } from '../middleware/session'
import { PinCard, PinDeleteConfirm } from '../views/components/PinCard'
import { PinForm } from '../views/components/PinForm'
import { PinDeletePage } from '../views/pages/pin-delete'
import { PinEditPage } from '../views/pages/pin-edit'
import { PinNewPage } from '../views/pages/pin-new'
import { PinsPage } from '../views/pages/pins'
import { PinsContentPartial } from '../views/partials/pins-content'

export interface PinRoutesOptions {
  /** Prefix for every link these routes generate, e.g. `/pins`. */
  baseUrl: string
  /**
   * The private variant: list only private pins, force new pins private, and
   * render the private page chrome.
   */
  privateMode?: boolean
}

/**
 * Read the list/filter query string.
 *
 * `privateMode` selects which half of the collection is visible. The two views
 * are mutually exclusive — the public list explicitly excludes private pins
 * rather than merely not asking for them.
 */
export function parsePinQueryParams(c: Context, privateMode = false) {
  const url = new URL(c.req.url)
  const tag = url.searchParams.get('tag') || undefined
  const search = url.searchParams.get('search') || undefined
  const unreadParam = url.searchParams.get('unread')
  const notagsParam = url.searchParams.get('notags')
  const pageParam = url.searchParams.get('page')
  // `?size=` is the old spelling, kept for one release so bookmarked links
  // still open compact. Everything emits `?view=` now, matching the card
  // routes, which never used `size`.
  const sizeParam = url.searchParams.get('view') ?? url.searchParams.get('size')
  const sortParam = url.searchParams.get('sort')
  const directionParam = url.searchParams.get('direction')

  const filter: PinFilter = { isPrivate: privateMode }

  if (tag) {
    filter.tag = tag
  }

  if (search) {
    filter.search = search
  }

  const noTags = notagsParam === 'true'
  if (noTags) {
    filter.noTags = true
  }

  let readFilter: 'all' | 'unread' | 'read' = 'all'
  if (unreadParam === 'true') {
    filter.readLater = true
    readFilter = 'unread'
  } else if (unreadParam === 'false') {
    filter.readLater = false
    readFilter = 'read'
  }

  const sortBy: 'created' | 'title' =
    sortParam === 'title' ? 'title' : 'created'
  const sortDirection: 'asc' | 'desc' =
    directionParam === 'asc' ? 'asc' : 'desc'

  filter.sortBy = sortBy
  filter.sortDirection = sortDirection

  // Anything that isn't a whole page number falls back to 1. A bare parseInt
  // lets `?page=abc` through as NaN, which becomes a NaN OFFSET at the
  // database and a 500 on a URL any crawler can type.
  const parsedPage = pageParam ? parseInt(pageParam, 10) : 1
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1

  const viewSize: 'expanded' | 'compact' =
    sizeParam === 'compact' ? 'compact' : 'expanded'

  const searchParams = url.search.replace(/^\?/, '')

  return {
    tag,
    search,
    readFilter,
    filter,
    page,
    viewSize,
    sortBy,
    sortDirection,
    searchParams,
    noTags,
  }
}

export async function fetchUserPins(
  user: User,
  filter: PinFilter,
  page: number
) {
  const ac = new AccessControl(user)
  return pinService.getUserPinsWithPagination(ac, filter, {
    page,
    pageSize: 25,
  })
}

/** Both "not found" and "not yours" surface as 404, so ownership stays opaque. */
function isMissingPin(error: unknown): boolean {
  return (
    error instanceof PinNotFoundError ||
    error instanceof UnauthorizedPinAccessError
  )
}

/**
 * Read `?view=` and strip it from the params that get carried into links.
 *
 * The view size travels separately from the list filters: a re-rendered card
 * needs to come back at the size the user was looking at, but the delete action
 * should carry only the filters.
 */
function takeViewSize(c: Context): {
  viewSize: 'expanded' | 'compact'
  searchParams: string
} {
  const url = new URL(c.req.url)
  const viewSize = (url.searchParams.get('view') || 'expanded') as
    'expanded' | 'compact'
  url.searchParams.delete('view')
  return { viewSize, searchParams: url.searchParams.toString() }
}

export function createPinRoutes({
  baseUrl,
  privateMode = false,
}: PinRoutesOptions): Hono {
  const routes = new Hono()

  // GET / — list pins with filtering and pagination
  routes.get('/', async c => {
    const sessionManager = getSessionManager(c)
    const user = getAuthUser(c)
    const isHtmx = !!c.req.header('HX-Request')

    const {
      tag,
      search,
      readFilter,
      filter,
      page,
      viewSize,
      sortBy,
      sortDirection,
      searchParams,
      noTags,
    } = parsePinQueryParams(c, privateMode)

    const result = await fetchUserPins(user, filter, page)

    const listProps = {
      pins: result.pins,
      pagination: result.pagination,
      searchParams,
      activeTag: tag,
      searchQuery: search,
      readFilter,
      viewSize,
      sortBy,
      sortDirection,
      noTags,
      baseUrl,
    }

    if (isHtmx) {
      return c.html(<PinsContentPartial {...listProps} />)
    }

    return c.html(
      <PinsPage
        {...listProps}
        user={user}
        flash={sessionManager.getFlash()}
        privateMode={privateMode}
      />
    )
  })

  // GET /new — pin creation form
  routes.get('/new', async c => {
    const sessionManager = getSessionManager(c)
    const user = getAuthUser(c)
    const ac = new AccessControl(user)

    // Bookmarklet integration, public list only: the private form is reached
    // deliberately from inside the app, never with a prefilled URL, so it does
    // no dedup lookup and a duplicate is caught on submit instead.
    let prefillUrl = ''
    let prefillTitle = ''
    let prefillDescription = ''
    let prefillTag = ''

    if (!privateMode) {
      const url = new URL(c.req.url)
      prefillUrl = url.searchParams.get('url') || ''
      prefillTitle = url.searchParams.get('title') || ''
      prefillDescription = url.searchParams.get('description') || ''
      prefillTag = url.searchParams.get('tag') || ''

      if (prefillUrl) {
        const existing = await pinService.findByUrl(ac, prefillUrl)

        if (existing) {
          return c.redirect(`${baseUrl}/${existing.id}/edit`)
        }
      }
    }

    const userTags = await tagService.getUserTags(ac, user.id)

    return c.html(
      <PinNewPage
        user={user}
        flash={sessionManager.getFlash()}
        userTags={userTags.map(t => t.name)}
        url={prefillUrl}
        title={prefillTitle}
        description={prefillDescription}
        tags={prefillTag}
        isPrivate={privateMode}
        baseUrl={baseUrl}
        privateMode={privateMode}
      />
    )
  })

  // POST /new — create a pin
  routes.post('/new', async c => {
    const sessionManager = getSessionManager(c)
    const user = getAuthUser(c)
    const ac = new AccessControl(user)

    const formData = await c.req.parseBody()
    const {
      url: pinUrl,
      title,
      description,
      readLater,
      isPrivate: submittedIsPrivate,
      tagsInput,
      tagNames,
    } = parsePinForm(formData)

    // The private form always stores a private pin; the submitted value is
    // ignored. (The edit route below deliberately does honour it.)
    const isPrivate = privateMode ? true : submittedIsPrivate

    const userTags = await tagService.getUserTags(ac, user.id)

    try {
      await pinService.createPin(ac, {
        userId: user.id,
        url: pinUrl,
        title,
        description,
        readLater,
        isPrivate,
        tagNames,
      })

      sessionManager.setFlash(
        'success',
        privateMode
          ? 'Private pin created successfully!'
          : 'Pin created successfully!'
      )
      if (c.req.header('HX-Request')) {
        c.header('HX-Redirect', baseUrl)
        return c.body(null)
      }
      return c.redirect(baseUrl)
    } catch (error) {
      const isHtmx = !!c.req.header('HX-Request')
      const userTagNames = userTags.map(t => t.name)

      const formProps = {
        action: `${baseUrl}/new`,
        submitLabel: 'Create Pin' as const,
        baseUrl,
        url: pinUrl,
        title,
        description: description || '',
        readLater,
        tags: tagsInput,
        userTags: userTagNames,
      }

      const pageProps = {
        user,
        userTags: userTagNames,
        url: pinUrl,
        title,
        description: description || '',
        readLater,
        tags: tagsInput,
        isPrivate: privateMode,
        baseUrl,
        privateMode,
      }

      if (error instanceof ValidationError) {
        if (isHtmx) {
          return c.html(<PinForm {...formProps} errors={error.fields} />)
        }
        return c.html(<PinNewPage {...pageProps} errors={error.fields} />)
      }

      if (error instanceof DuplicatePinError) {
        const duplicatePinId = error.existingPin?.id
        if (isHtmx) {
          return c.html(
            <PinForm {...formProps} duplicatePinId={duplicatePinId} />
          )
        }
        return c.html(
          <PinNewPage {...pageProps} duplicatePinId={duplicatePinId} />
        )
      }

      const errors = { _form: ['Failed to create pin. Please try again.'] }
      if (isHtmx) {
        return c.html(<PinForm {...formProps} errors={errors} />, 500)
      }
      return c.html(<PinNewPage {...pageProps} errors={errors} />, 500)
    }
  })

  // GET /:id/edit — pin edit form
  routes.get('/:id/edit', async c => {
    const sessionManager = getSessionManager(c)
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)

    const url = new URL(c.req.url)
    const returnParams = url.search.replace(/^\?/, '')

    try {
      const [pin, userTags] = await Promise.all([
        pinService.getPin(ac, pinId),
        tagService.getUserTags(ac, user.id),
      ])

      return c.html(
        <PinEditPage
          user={user}
          pin={pin}
          flash={sessionManager.getFlash()}
          userTags={userTags.map(t => t.name)}
          returnParams={returnParams}
          baseUrl={baseUrl}
          privateMode={privateMode}
        />
      )
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  // POST /:id/edit — update a pin
  routes.post('/:id/edit', async c => {
    const sessionManager = getSessionManager(c)
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)

    const requestUrl = new URL(c.req.url)
    const returnParams = requestUrl.search.replace(/^\?/, '')
    const redirectTarget = returnParams ? `${baseUrl}?${returnParams}` : baseUrl
    const editAction = `${baseUrl}/${pinId}/edit${
      returnParams ? `?${returnParams}` : ''
    }`

    const formData = await c.req.parseBody()
    const {
      url: pinUrl,
      title,
      description,
      readLater,
      isPrivate,
      tagsInput,
      tagNames,
    } = parsePinForm(formData)

    const userTags = await tagService.getUserTags(ac, user.id)

    try {
      const existingPin = await pinService.getPin(ac, pinId)

      await pinService.updatePin(ac, {
        id: pinId,
        userId: existingPin.userId,
        url: pinUrl,
        title,
        description,
        readLater,
        isPrivate,
        tagNames,
      })

      sessionManager.setFlash('success', 'Pin updated successfully!')
      if (c.req.header('HX-Request')) {
        c.header('HX-Redirect', redirectTarget)
        return c.body(null)
      }
      return c.redirect(redirectTarget)
    } catch (error) {
      let pin
      try {
        pin = await pinService.getPin(ac, pinId)
      } catch {
        return c.text('Pin not found', 404)
      }

      const isHtmx = !!c.req.header('HX-Request')
      const userTagNames = userTags.map(t => t.name)

      const formProps = {
        action: editAction,
        submitLabel: 'Update Pin' as const,
        baseUrl,
        url: pinUrl,
        title,
        description: description || '',
        readLater,
        tags: tagsInput,
        userTags: userTagNames,
        createdAt: pin.createdAt,
      }

      const pageProps = {
        user,
        pin,
        userTags: userTagNames,
        url: pinUrl,
        title,
        description: description || '',
        readLater,
        tags: tagsInput,
        returnParams,
        baseUrl,
        privateMode,
        // Only the private form feeds the submitted value back. On the public
        // form this stays undefined so PinEditPage falls back to the pin's own
        // isPrivate (`isPrivate ?? pin.isPrivate`) rather than the form's.
        isPrivate: privateMode ? isPrivate : undefined,
      }

      if (error instanceof ValidationError) {
        if (isHtmx) {
          return c.html(<PinForm {...formProps} errors={error.fields} />)
        }
        return c.html(<PinEditPage {...pageProps} errors={error.fields} />)
      }

      if (error instanceof DuplicatePinError) {
        const duplicatePinId = error.existingPin?.id
        if (isHtmx) {
          return c.html(
            <PinForm {...formProps} duplicatePinId={duplicatePinId} />
          )
        }
        return c.html(
          <PinEditPage {...pageProps} duplicatePinId={duplicatePinId} />
        )
      }

      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }

      const errors = { _form: ['Failed to update pin. Please try again.'] }
      if (isHtmx) {
        return c.html(<PinForm {...formProps} errors={errors} />, 500)
      }
      return c.html(<PinEditPage {...pageProps} errors={errors} />, 500)
    }
  })

  // POST /:id/toggle-read — flip read-later and swap the card (HTMX)
  routes.post('/:id/toggle-read', async c => {
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)
    // The card states its own size and filters on the hx-post URL, exactly as
    // delete-confirm does. Deriving them from `Referer` instead meant a proxy
    // that strips the header re-rendered a compact card as an expanded one.
    const { viewSize, searchParams } = takeViewSize(c)

    try {
      const existingPin = await pinService.getPin(ac, pinId)

      const updatedPin = await pinService.updatePin(ac, {
        id: existingPin.id,
        userId: existingPin.userId,
        url: existingPin.url,
        title: existingPin.title,
        description: existingPin.description,
        readLater: !existingPin.readLater,
        isPrivate: existingPin.isPrivate,
        tagNames: existingPin.tagNames,
      })

      return c.html(
        <PinCard
          pin={updatedPin}
          viewSize={viewSize}
          searchParams={searchParams}
          baseUrl={baseUrl}
        />
      )
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  // GET /:id/delete-confirm — inline delete confirmation (HTMX)
  routes.get('/:id/delete-confirm', async c => {
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)
    const { viewSize, searchParams } = takeViewSize(c)

    try {
      const pin = await pinService.getPin(ac, pinId)

      return c.html(
        <PinDeleteConfirm
          pin={pin}
          viewSize={viewSize}
          searchParams={searchParams}
          baseUrl={baseUrl}
        />
      )
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  // DELETE /:id — delete and return the refreshed list (HTMX)
  routes.delete('/:id', async c => {
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)

    try {
      await pinService.deletePin(ac, pinId)

      const {
        tag,
        search,
        readFilter,
        filter,
        page,
        viewSize,
        sortBy,
        sortDirection,
        searchParams,
        noTags,
      } = parsePinQueryParams(c, privateMode)
      const result = await fetchUserPins(user, filter, page)

      return c.html(
        <PinsContentPartial
          pins={result.pins}
          pagination={result.pagination}
          searchParams={searchParams}
          activeTag={tag}
          searchQuery={search}
          readFilter={readFilter}
          viewSize={viewSize}
          sortBy={sortBy}
          sortDirection={sortDirection}
          noTags={noTags}
          baseUrl={baseUrl}
        />
      )
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  // GET /:id/card — re-render one card (HTMX, used to cancel a confirmation)
  routes.get('/:id/card', async c => {
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)
    const { viewSize, searchParams } = takeViewSize(c)

    try {
      const pin = await pinService.getPin(ac, pinId)

      return c.html(
        <PinCard
          pin={pin}
          viewSize={viewSize}
          searchParams={searchParams}
          baseUrl={baseUrl}
        />
      )
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  // GET /:id/delete — full-page confirmation (non-JS fallback)
  routes.get('/:id/delete', async c => {
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)

    try {
      const pin = await pinService.getPin(ac, pinId)

      return c.html(
        <PinDeletePage
          user={user}
          pin={pin}
          baseUrl={baseUrl}
          privateMode={privateMode}
        />
      )
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  // POST /:id/delete — delete from the full-page confirmation
  routes.post('/:id/delete', async c => {
    const sessionManager = getSessionManager(c)
    const user = getAuthUser(c)

    const pinId = c.req.param('id')
    const ac = new AccessControl(user)

    try {
      await pinService.deletePin(ac, pinId)

      sessionManager.setFlash('success', 'Pin deleted successfully!')
      return c.redirect(baseUrl)
    } catch (error) {
      if (isMissingPin(error)) {
        return c.text('Pin not found', 404)
      }
      throw error
    }
  })

  return routes
}
