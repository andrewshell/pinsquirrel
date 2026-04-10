import { Hono, type Context } from 'hono'
import {
  AccessControl,
  Pagination,
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
  type Pin,
  type PinFilter,
} from '@pinsquirrel/domain'
import {
  pinListInputSchema,
  tagListInputSchema,
  type PinListInput,
} from '@pinsquirrel/services'
import { pinService, tagService } from '../lib/services'
import { tagRepository } from '../lib/db'
import { apiKeyAuth, getApiUser } from '../middleware/api-auth'

const apiV1 = new Hono()

// TODO: write endpoints (POST/PUT/DELETE) will need CSRF bypass when added.
apiV1.use('*', apiKeyAuth())

function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? 'Invalid query'
}

/**
 * Convert raw HTTP query-string values (all strings) into the typed shape
 * that `pinListInputSchema` / `tagListInputSchema` expect. Unknown/absent
 * fields are dropped so schema `.optional()` handles them.
 */
function coerceQuery(
  raw: Record<string, string>,
  numberKeys: readonly string[],
  booleanKeys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw }
  for (const key of numberKeys) {
    if (raw[key] !== undefined) {
      const n = Number(raw[key])
      out[key] = Number.isNaN(n) ? raw[key] : n
    }
  }
  for (const key of booleanKeys) {
    if (raw[key] !== undefined) {
      if (raw[key] === 'true' || raw[key] === '1') out[key] = true
      else if (raw[key] === 'false' || raw[key] === '0') out[key] = false
      // else leave as string so the schema rejects it with a useful error
    }
  }
  return out
}

const PIN_LIST_NUMBER_KEYS = ['page', 'pageSize'] as const
const PIN_LIST_BOOLEAN_KEYS = ['readLater', 'noTags'] as const
const TAG_LIST_BOOLEAN_KEYS = ['withCounts'] as const

function pinFilterFromInput(input: PinListInput): PinFilter {
  return {
    isPrivate: false,
    tag: input.tag,
    search: input.search,
    readLater: input.readLater,
    noTags: input.noTags,
    sortBy: input.sortBy,
    sortDirection: input.sortDirection,
  }
}

function serializePin(pin: Pin) {
  return {
    id: pin.id,
    url: pin.url,
    title: pin.title,
    description: pin.description,
    readLater: pin.readLater,
    tags: pin.tagNames,
    createdAt: pin.createdAt.toISOString(),
    updatedAt: pin.updatedAt.toISOString(),
  }
}

function serializePagination(p: Pagination) {
  return {
    page: p.page,
    pageSize: p.pageSize,
    totalCount: p.totalCount,
    totalPages: p.totalPages,
    hasNext: p.hasNext,
    hasPrevious: p.hasPrevious,
  }
}

// GET /api/v1/pins - list pins (excludes private pins)
apiV1.get('/pins', async (c) => {
  const user = getApiUser(c)
  const ac = new AccessControl(user)

  const parsed = pinListInputSchema.safeParse(
    coerceQuery(c.req.query(), PIN_LIST_NUMBER_KEYS, PIN_LIST_BOOLEAN_KEYS)
  )
  if (!parsed.success) {
    return c.json({ error: firstIssue(parsed.error.issues) }, 400)
  }
  const input = parsed.data

  try {
    const result = await pinService.getUserPinsWithPagination(
      ac,
      pinFilterFromInput(input),
      { page: input.page, pageSize: input.pageSize }
    )
    return c.json({
      data: result.pins.map(serializePin),
      pagination: serializePagination(result.pagination),
    })
  } catch (err) {
    return errorResponse(c, err)
  }
})

// GET /api/v1/pins/:id - single pin
apiV1.get('/pins/:id', async (c) => {
  const user = getApiUser(c)
  const ac = new AccessControl(user)
  const id = c.req.param('id')

  try {
    const pin = await pinService.getPin(ac, id)
    if (pin.isPrivate) {
      return c.json({ error: 'Pin not found' }, 404)
    }
    return c.json({ data: serializePin(pin) })
  } catch (err) {
    return errorResponse(c, err)
  }
})

// GET /api/v1/tags - list user's tags
apiV1.get('/tags', async (c) => {
  const user = getApiUser(c)
  const ac = new AccessControl(user)

  const parsed = tagListInputSchema.safeParse(
    coerceQuery(c.req.query(), [], TAG_LIST_BOOLEAN_KEYS)
  )
  if (!parsed.success) {
    return c.json({ error: firstIssue(parsed.error.issues) }, 400)
  }

  try {
    if (parsed.data.withCounts) {
      const tags = await tagService.getUserTagsWithCount(ac, user.id)
      return c.json({
        data: tags.map((t) => ({
          id: t.id,
          name: t.name,
          pinCount: t.pinCount,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      })
    }
    const tags = await tagService.getUserTags(ac, user.id)
    return c.json({
      data: tags.map((t) => ({
        id: t.id,
        name: t.name,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    return errorResponse(c, err)
  }
})

// GET /api/v1/tags/:id/pins - pins for a tag (by tag id, excludes private)
apiV1.get('/tags/:id/pins', async (c) => {
  const user = getApiUser(c)
  const ac = new AccessControl(user)
  const tagId = c.req.param('id')

  const parsed = pinListInputSchema.safeParse(
    coerceQuery(c.req.query(), PIN_LIST_NUMBER_KEYS, PIN_LIST_BOOLEAN_KEYS)
  )
  if (!parsed.success) {
    return c.json({ error: firstIssue(parsed.error.issues) }, 400)
  }
  const input = parsed.data

  try {
    const tag = await tagRepository.findById(tagId)
    if (!tag || tag.userId !== user.id) {
      return c.json({ error: 'Tag not found' }, 404)
    }

    const result = await pinService.getUserPinsWithPagination(
      ac,
      { ...pinFilterFromInput(input), tag: tag.name },
      { page: input.page, pageSize: input.pageSize }
    )
    return c.json({
      data: result.pins.map(serializePin),
      pagination: serializePagination(result.pagination),
    })
  } catch (err) {
    return errorResponse(c, err)
  }
})

function errorResponse(c: Context, err: unknown) {
  if (err instanceof ValidationError) {
    return c.json({ error: 'Invalid request' }, 400)
  }
  if (err instanceof PinNotFoundError || err instanceof TagNotFoundError) {
    return c.json({ error: err.message }, 404)
  }
  if (
    err instanceof UnauthorizedPinAccessError ||
    err instanceof UnauthorizedTagAccessError
  ) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({ error: 'Internal server error' }, 500)
}

export { apiV1 as apiV1Routes }
