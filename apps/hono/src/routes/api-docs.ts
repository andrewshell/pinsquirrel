import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { apiV1Routes } from './api-v1'

const api = new OpenAPIHono()

// --- Security scheme registration (shared across all API versions) ----------

api.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'API key passed as Bearer token in Authorization header',
})

api.openAPIRegistry.registerComponent('securitySchemes', 'apiKeyHeader', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
  description: 'API key passed via X-API-Key header',
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
      'API for managing bookmarks and tags in PinSquirrel. All endpoints require API key authentication.',
  },
  servers: [{ url: '/api', description: 'PinSquirrel API' }],
  security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
})

api.get(
  '/docs',
  Scalar({
    url: '/api/openapi.json',
  })
)

export { api as apiRoutes }
