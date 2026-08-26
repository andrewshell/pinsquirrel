import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { apiV1Routes } from './api-v1'

const api = new OpenAPIHono()

// --- Security scheme registration (shared across all API versions) ----------

// One scheme, because there is one credential form. `X-API-Key` existed only
// for the `ps_` API keys and left with them (Decision 12); advertising it here
// would send a client after a credential nothing accepts.
api.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description:
    'OAuth 2.1 access token passed as a Bearer token in the Authorization header. ' +
    'Obtain one via the authorization code flow described at ' +
    '/.well-known/oauth-authorization-server; the token must be bound to the ' +
    'resource https://pinsquirrel.com/api/v1.',
})

// --- Mount versioned API sub-apps -------------------------------------------
// OpenAPIHono.route() merges registries, so v1 paths appear under /v1/* in the spec.

api.route('/v1', apiV1Routes)

// --- OpenAPI spec & Scalar UI -----------------------------------------------

api.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'PinSquirrel API',
    version: 'v1',
    description:
      'API for managing bookmarks and tags in PinSquirrel. All endpoints require an OAuth 2.1 access token issued for the https://pinsquirrel.com/api/v1 resource.',
  },
  servers: [{ url: '/api', description: 'PinSquirrel API' }],
  security: [{ bearerAuth: [] }],
})

api.get(
  '/docs',
  Scalar({
    url: '/api/openapi.json',
  })
)

export { api as apiRoutes }
