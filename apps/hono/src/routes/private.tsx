import { Hono } from 'hono'
import {
  AccessControl,
  ValidationError,
  DuplicatePinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
  InvalidCredentialsError,
} from '@pinsquirrel/domain'
import { authService, pinService, tagService } from '../lib/services'
import { getSessionManager, requireAuth } from '../middleware/session'
import { requirePrivateUnlock } from '../middleware/private-mode'
import { PinCard, PinDeleteConfirm } from '../views/components/PinCard'
import { PinForm } from '../views/components/PinForm'
import { PinDeletePage } from '../views/pages/pin-delete'
import { PinEditPage } from '../views/pages/pin-edit'
import { PinNewPage } from '../views/pages/pin-new'
import { PinsPage } from '../views/pages/pins'
import { PinsContentPartial } from '../views/partials/pins-content'
import { PrivateUnlockPage } from '../views/pages/private-unlock'
import { parsePinQueryParams, fetchUserPins } from './pins'

const BASE_URL = '/private/pins'

const privateRouter = new Hono()

// All private routes require authentication
privateRouter.use('*', requireAuth())

// GET /private/unlock — Password form
privateRouter.get('/unlock', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  // If already unlocked, redirect to private pins
  if (sessionManager.isPrivateUnlocked()) {
    return c.redirect(BASE_URL)
  }

  return c.html(<PrivateUnlockPage user={user} />)
})

// POST /private/unlock — Verify password and unlock
privateRouter.post('/unlock', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const formData = await c.req.parseBody()
  const password =
    typeof formData.password === 'string' ? formData.password : ''

  try {
    await authService.login({ username: user.username, password })
    sessionManager.unlockPrivateMode()
    return c.redirect(BASE_URL)
  } catch (error) {
    if (
      error instanceof InvalidCredentialsError ||
      error instanceof ValidationError
    ) {
      return c.html(<PrivateUnlockPage user={user} error="Invalid password." />)
    }
    throw error
  }
})

// POST /private/lock — Lock private mode and redirect
privateRouter.post('/lock', (c) => {
  const sessionManager = getSessionManager(c)
  sessionManager.lockPrivateMode()

  // For beacon requests (tab close), return 204
  if (c.req.header('Content-Type')?.includes('text/plain')) {
    return c.body(null, 204)
  }

  return c.redirect('/pins')
})

// All pin routes below require private unlock
privateRouter.use('/pins/*', requirePrivateUnlock())
privateRouter.use('/pins', requirePrivateUnlock())

// GET /private/pins — List private pins
privateRouter.get('/pins', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()
  const isHtmx = !!c.req.header('HX-Request')

  if (!user) {
    if (isHtmx) {
      c.header('HX-Redirect', '/signin')
      return c.body(null, 204)
    }
    return c.redirect('/signin')
  }

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
  } = parsePinQueryParams(c)

  // Override to show only private pins
  filter.isPrivate = true

  const result = await fetchUserPins(user, filter, page)

  if (isHtmx) {
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
        baseUrl={BASE_URL}
      />
    )
  }

  const flash = sessionManager.getFlash()

  return c.html(
    <PinsPage
      user={user}
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
      flash={flash}
      baseUrl={BASE_URL}
      privateMode
    />
  )
})

// GET /private/pins/new — Create private pin form
privateRouter.get('/pins/new', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)
  const userTags = await tagService.getUserTags(ac, user.id)
  const flash = sessionManager.getFlash()

  return c.html(
    <PinNewPage
      user={user}
      flash={flash}
      userTags={userTags.map((t) => t.name)}
      isPrivate
      baseUrl={BASE_URL}
      privateMode
    />
  )
})

// POST /private/pins/new — Create a private pin
privateRouter.post('/pins/new', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const ac = new AccessControl(user)
  const formData = await c.req.parseBody()

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

  const tagNames = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  const userTags = await tagService.getUserTags(ac, user.id)

  try {
    await pinService.createPin(ac, {
      userId: user.id,
      url: pinUrl,
      title,
      description,
      readLater,
      isPrivate: true,
      tagNames,
    })

    sessionManager.setFlash('success', 'Private pin created successfully!')
    if (c.req.header('HX-Request')) {
      c.header('HX-Redirect', BASE_URL)
      return c.body(null)
    }
    return c.redirect(BASE_URL)
  } catch (error) {
    const isHtmx = !!c.req.header('HX-Request')
    const userTagNames = userTags.map((t) => t.name)

    const formProps = {
      action: `${BASE_URL}/new` as const,
      submitLabel: 'Create Pin' as const,
      url: pinUrl,
      title,
      description: description || '',
      readLater,
      isPrivate: true,
      tags: tagsInput,
      userTags: userTagNames,
    }

    if (error instanceof ValidationError) {
      if (isHtmx) {
        return c.html(<PinForm {...formProps} errors={error.fields} />)
      }
      return c.html(
        <PinNewPage
          user={user}
          errors={error.fields}
          userTags={userTagNames}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          isPrivate
          tags={tagsInput}
          baseUrl={BASE_URL}
          privateMode
        />
      )
    }

    if (error instanceof DuplicatePinError) {
      const duplicatePinId = error.existingPin?.id
      if (isHtmx) {
        return c.html(
          <PinForm {...formProps} duplicatePinId={duplicatePinId} />
        )
      }
      return c.html(
        <PinNewPage
          user={user}
          duplicatePinId={duplicatePinId}
          userTags={userTagNames}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          isPrivate
          tags={tagsInput}
          baseUrl={BASE_URL}
          privateMode
        />
      )
    }

    const errors = { _form: ['Failed to create pin. Please try again.'] }
    if (isHtmx) {
      return c.html(<PinForm {...formProps} errors={errors} />, 500)
    }
    return c.html(
      <PinNewPage
        user={user}
        errors={errors}
        userTags={userTagNames}
        url={pinUrl}
        title={title}
        description={description || ''}
        readLater={readLater}
        isPrivate
        tags={tagsInput}
        baseUrl={BASE_URL}
        privateMode
      />,
      500
    )
  }
})

// GET /private/pins/:id/edit
privateRouter.get('/pins/:id/edit', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)
  const url = new URL(c.req.url)
  const returnParams = url.search.replace(/^\?/, '')

  try {
    const [pin, userTags] = await Promise.all([
      pinService.getPin(ac, pinId),
      tagService.getUserTags(ac, user.id),
    ])

    const flash = sessionManager.getFlash()

    return c.html(
      <PinEditPage
        user={user}
        pin={pin}
        flash={flash}
        userTags={userTags.map((t) => t.name)}
        returnParams={returnParams}
        baseUrl={BASE_URL}
        privateMode
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

// POST /private/pins/:id/edit
privateRouter.post('/pins/:id/edit', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)
  const requestUrl = new URL(c.req.url)
  const returnParams = requestUrl.search.replace(/^\?/, '')
  const redirectTarget = returnParams ? `${BASE_URL}?${returnParams}` : BASE_URL
  const editAction = `${BASE_URL}/${pinId}/edit${returnParams ? `?${returnParams}` : ''}`

  const formData = await c.req.parseBody()

  const getString = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return getString(value[0])
    return ''
  }

  const pinUrl = getString(formData.url)
  const title = getString(formData.title)
  const description = getString(formData.description) || null
  const readLater = getString(formData.readLater) === 'true'
  const isPrivate = getString(formData.isPrivate) === 'true'
  const tagsInput = getString(formData.tags)

  const tagNames = tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

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
    const userTagNames = userTags.map((t) => t.name)

    const formProps = {
      action: editAction,
      submitLabel: 'Update Pin' as const,
      url: pinUrl,
      title,
      description: description || '',
      readLater,
      isPrivate,
      tags: tagsInput,
      userTags: userTagNames,
      createdAt: pin.createdAt,
    }

    if (error instanceof ValidationError) {
      if (isHtmx) {
        return c.html(<PinForm {...formProps} errors={error.fields} />)
      }
      return c.html(
        <PinEditPage
          user={user}
          pin={pin}
          errors={error.fields}
          userTags={userTagNames}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          isPrivate={isPrivate}
          tags={tagsInput}
          returnParams={returnParams}
          baseUrl={BASE_URL}
          privateMode
        />
      )
    }

    if (error instanceof DuplicatePinError) {
      const duplicatePinId = error.existingPin?.id
      if (isHtmx) {
        return c.html(
          <PinForm {...formProps} duplicatePinId={duplicatePinId} />
        )
      }
      return c.html(
        <PinEditPage
          user={user}
          pin={pin}
          duplicatePinId={duplicatePinId}
          userTags={userTagNames}
          url={pinUrl}
          title={title}
          description={description || ''}
          readLater={readLater}
          isPrivate={isPrivate}
          tags={tagsInput}
          returnParams={returnParams}
          baseUrl={BASE_URL}
          privateMode
        />
      )
    }

    if (
      error instanceof PinNotFoundError ||
      error instanceof UnauthorizedPinAccessError
    ) {
      return c.text('Pin not found', 404)
    }

    const errors = { _form: ['Failed to update pin. Please try again.'] }
    if (isHtmx) {
      return c.html(<PinForm {...formProps} errors={errors} />, 500)
    }
    return c.html(
      <PinEditPage
        user={user}
        pin={pin}
        errors={errors}
        userTags={userTagNames}
        url={pinUrl}
        title={title}
        description={description || ''}
        readLater={readLater}
        isPrivate={isPrivate}
        tags={tagsInput}
        returnParams={returnParams}
        baseUrl={BASE_URL}
        privateMode
      />,
      500
    )
  }
})

// POST /private/pins/:id/toggle-read
privateRouter.post('/pins/:id/toggle-read', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    c.header('HX-Redirect', '/signin')
    return c.body(null, 204)
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)
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

  const referer = c.req.header('Referer') || ''
  let searchParams = ''
  try {
    const refererUrl = new URL(referer)
    searchParams = refererUrl.search.replace(/^\?/, '')
  } catch {
    // Ignore invalid referer
  }

  return c.html(
    <PinCard
      pin={updatedPin}
      viewSize="expanded"
      searchParams={searchParams}
      baseUrl={BASE_URL}
    />
  )
})

// GET /private/pins/:id/delete-confirm
privateRouter.get('/pins/:id/delete-confirm', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    c.header('HX-Redirect', '/signin')
    return c.body(null, 204)
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)
  const url = new URL(c.req.url)
  const viewSize = (url.searchParams.get('view') || 'expanded') as
    | 'expanded'
    | 'compact'
  url.searchParams.delete('view')
  const searchParams = url.searchParams.toString()

  try {
    const pin = await pinService.getPin(ac, pinId)
    return c.html(
      <PinDeleteConfirm
        pin={pin}
        viewSize={viewSize}
        searchParams={searchParams}
        baseUrl={BASE_URL}
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

// DELETE /private/pins/:id
privateRouter.delete('/pins/:id', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    c.header('HX-Redirect', '/signin')
    return c.body(null, 204)
  }

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
    } = parsePinQueryParams(c)

    filter.isPrivate = true
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
        baseUrl={BASE_URL}
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

// GET /private/pins/:id/card
privateRouter.get('/pins/:id/card', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    c.header('HX-Redirect', '/signin')
    return c.body(null, 204)
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)
  const url = new URL(c.req.url)
  const viewSize = (url.searchParams.get('view') || 'expanded') as
    | 'expanded'
    | 'compact'
  url.searchParams.delete('view')
  const searchParams = url.searchParams.toString()

  try {
    const pin = await pinService.getPin(ac, pinId)
    return c.html(
      <PinCard
        pin={pin}
        viewSize={viewSize}
        searchParams={searchParams}
        baseUrl={BASE_URL}
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

// GET /private/pins/:id/delete — Full page delete confirmation
privateRouter.get('/pins/:id/delete', async (c) => {
  const sessionManager = getSessionManager(c)
  const user = await sessionManager.getUser()

  if (!user) {
    return c.redirect('/signin')
  }

  const pinId = c.req.param('id')
  const ac = new AccessControl(user)

  try {
    const pin = await pinService.getPin(ac, pinId)
    return c.html(
      <PinDeletePage user={user} pin={pin} baseUrl={BASE_URL} privateMode />
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

// POST /private/pins/:id/delete
privateRouter.post('/pins/:id/delete', async (c) => {
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
    return c.redirect(BASE_URL)
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

export { privateRouter as privateRoutes }
