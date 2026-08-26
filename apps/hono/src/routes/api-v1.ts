import { type Context } from 'hono'
import { OpenAPIHono, z } from '@hono/zod-openapi'
import {
  AccessControl,
  PinNotFoundError,
  TagNotFoundError,
  UnauthorizedPinAccessError,
  UnauthorizedTagAccessError,
  ValidationError,
} from '@pinsquirrel/domain'
import {
  pinListQuerySchema,
  tagListQuerySchema,
  pinSchema,
  tagSchema,
  tagWithCountSchema,
  paginatedPinsSchema,
  errorSchema,
  pinFilterFromInput,
} from '@pinsquirrel/services'
import { pinService, tagService } from '../lib/services'
import { oauthAuth, getOAuthUser } from '../middleware/oauth-auth'
import { oauthConfig } from '../lib/config'
import { apiV1Limiter, rateLimitByIp } from '../middleware/rate-limit'

const apiV1 = new OpenAPIHono()

// --- OpenAPI route specs (for spec generation only) -------------------------

// One credential form: an OAuth access token in `Authorization: Bearer`.
// `X-API-Key` left with the API keys (Decision 12).
const security: Record<string, string[]>[] = [{ bearerAuth: [] }]

apiV1.openAPIRegistry.registerPath({
  method: 'get',
  path: '/pins',
  tags: ['Pins'],
  summary: 'List pins',
  description:
    'List public pins for the authenticated user with optional filtering and pagination.',
  security,
  request: { query: pinListQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: paginatedPinsSchema } },
      description: 'Paginated list of pins',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Unauthorized',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Internal server error',
    },
  },
})

apiV1.openAPIRegistry.registerPath({
  method: 'get',
  path: '/pins/{id}',
  tags: ['Pins'],
  summary: 'Get a pin',
  description:
    'Get a single pin by ID. Returns 404 for private or non-existent pins.',
  security,
  request: {
    params: z.object({
      id: z.string().describe('Pin ID'),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: pinSchema } },
      description: 'Pin details',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Pin not found',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Internal server error',
    },
  },
})

apiV1.openAPIRegistry.registerPath({
  method: 'get',
  path: '/tags',
  tags: ['Tags'],
  summary: 'List tags',
  description:
    "List the authenticated user's tags, optionally including pin counts.",
  security,
  request: { query: tagListQuerySchema },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.union([z.array(tagSchema), z.array(tagWithCountSchema)]),
        },
      },
      description: 'List of tags (with or without counts)',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Unauthorized',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Internal server error',
    },
  },
})

apiV1.openAPIRegistry.registerPath({
  method: 'get',
  path: '/tags/{id}/pins',
  tags: ['Tags'],
  summary: 'List pins for a tag',
  description:
    'Get public pins associated with a specific tag. Returns 404 if the tag does not exist or does not belong to the user.',
  security,
  request: {
    params: z.object({
      id: z.string().describe('Tag ID'),
    }),
    query: pinListQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: paginatedPinsSchema } },
      description: 'Paginated list of pins for the tag',
    },
    400: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Validation error',
    },
    401: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Unauthorized',
    },
    404: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Tag not found',
    },
    500: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Internal server error',
    },
  },
})

// --- Auth middleware (applies to all routes) ---------------------------------

// TODO: write endpoints (POST/PUT/DELETE) will need CSRF bypass when added.
//
// The REST API is an OAuth protected resource with its own identifier, and
// the middleware is handed exactly that one: a token minted for `/mcp` has to
// be refused here (Decision 18).
// Ahead of the auth check, and on its own limiter so a flood at /mcp cannot
// spend this budget. Both resources are authenticated, so what this bounds is
// abuse rather than credential guessing.
apiV1.use(
  '*',
  rateLimitByIp(apiV1Limiter, 'Too many requests. Please try again later.')
)
apiV1.use('*', oauthAuth(oauthConfig.resources.apiV1))

// --- Helpers ----------------------------------------------------------------

function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? 'Invalid query'
}

function errorResponse(c: Context, err: unknown) {
  if (err instanceof ValidationError) {
    return c.json({ error: 'Invalid request' }, 400)
  }
  // 404, not 403, and with the id left out of the body: a pin or tag owned by
  // another user is indistinguishable from one that does not exist, which is
  // the rule the HTML routes already follow so ownership stays opaque. This
  // 404 is unrelated to oauthAuth's 401 - that one answers "who are you?" and
  // is settled before any handler runs (it is the one that carries
  // WWW-Authenticate).
  if (
    err instanceof PinNotFoundError ||
    err instanceof UnauthorizedPinAccessError
  ) {
    return c.json({ error: 'Pin not found' }, 404)
  }
  if (
    err instanceof TagNotFoundError ||
    err instanceof UnauthorizedTagAccessError
  ) {
    return c.json({ error: 'Tag not found' }, 404)
  }
  return c.json({ error: 'Internal server error' }, 500)
}

// --- Route handlers ---------------------------------------------------------

// GET /api/v1/pins - list pins (excludes private pins)
apiV1.get('/pins', async c => {
  const user = getOAuthUser(c)
  const ac = new AccessControl(user)

  const parsed = pinListQuerySchema.safeParse(c.req.query())
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
    return c.json(result)
  } catch (err) {
    return errorResponse(c, err)
  }
})

// GET /api/v1/pins/:id - single pin
apiV1.get('/pins/:id', async c => {
  const user = getOAuthUser(c)
  const ac = new AccessControl(user)
  const id = c.req.param('id')

  try {
    const pin = await pinService.getPublicPin(ac, id)
    return c.json(pin)
  } catch (err) {
    return errorResponse(c, err)
  }
})

// GET /api/v1/tags - list user's tags
apiV1.get('/tags', async c => {
  const user = getOAuthUser(c)
  const ac = new AccessControl(user)

  const parsed = tagListQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: firstIssue(parsed.error.issues) }, 400)
  }

  try {
    const tags = parsed.data.withCounts
      ? await tagService.getUserTagsWithCount(ac, user.id)
      : await tagService.getUserTags(ac, user.id)
    return c.json(tags)
  } catch (err) {
    return errorResponse(c, err)
  }
})

// GET /api/v1/tags/:id/pins - pins for a tag (by tag id, excludes private)
apiV1.get('/tags/:id/pins', async c => {
  const user = getOAuthUser(c)
  const ac = new AccessControl(user)
  const tagId = c.req.param('id')

  const parsed = pinListQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: firstIssue(parsed.error.issues) }, 400)
  }
  const input = parsed.data

  try {
    const tag = await tagService.getUserTagById(ac, tagId)
    const result = await pinService.getUserPinsWithPagination(
      ac,
      { ...pinFilterFromInput(input), tag: tag.name },
      { page: input.page, pageSize: input.pageSize }
    )
    return c.json(result)
  } catch (err) {
    return errorResponse(c, err)
  }
})

export { apiV1 as apiV1Routes }
