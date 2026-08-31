import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@pinsquirrel/domain'

const mockVerifyAccessToken = vi.fn()
const mockGetUserPinsWithPagination = vi.fn()

// The MCP server and its transport are built per request by the route itself
// (see `routes/mcp.ts`), so there is no transport to mock by name here. What
// stands in for the world below is the service the `list_pins` tool calls:
// whether it ran is how these cases tell "the request reached the MCP server"
// from "the request was refused at the door".
vi.mock('../lib/services', () => ({
  oauthService: {
    verifyAccessToken: (...args: unknown[]) =>
      mockVerifyAccessToken(...args) as unknown,
  },
  pinService: {
    getUserPinsWithPagination: (...args: unknown[]) =>
      mockGetUserPinsWithPagination(...args) as unknown,
  },
  tagService: {
    getUserTags: vi.fn(),
    getUserTagsWithCount: vi.fn(),
  },
}))

import { mcpLimiter } from '../middleware/rate-limit'
import { TEST_CLIENT_IP, exhaust } from '../test-support/rate-limit'
import { mcpRoutes } from './mcp'

const TOOL_CALL = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'list_pins', arguments: {} },
})

const EXPECTED_CHALLENGE =
  'Bearer resource_metadata="http://localhost:8100/.well-known/oauth-protected-resource/mcp", scope="pins:read tags:read pins:write tags:write"'

const testUser = { id: 'user-1', username: 'alice' } as unknown as User

/**
 * A token that is only good for one resource, which is what the audience
 * check in `verifyAccessToken` decides. Mocking it this way is what makes the
 * cross-resource cases here real: the route passes its own resource in, or
 * the token opens both doors.
 */
function tokenFor(resource: string) {
  return (_raw: unknown, expectedResource: unknown) =>
    expectedResource === resource
      ? {
          token: { id: 'token-1' },
          user: testUser,
          clientId: 'client-1',
          scopes: ['pins:read', 'tags:read'],
        }
      : null
}

describe('mcp route auth', () => {
  let app: Hono
  let seenAuth: unknown

  beforeEach(() => {
    vi.resetAllMocks()
    // A module-level limiter outlives a single test, so each case starts with
    // its own budget rather than inheriting whatever the last one spent.
    mcpLimiter.reset(TEST_CLIENT_IP)
    seenAuth = undefined
    app = new Hono()
    // `route()` merges the MCP handlers into this router, so they run on the
    // same Context this sees on the way back out. That is how a test reads the
    // `AuthInfo` the middleware wrote for the SDK. Registered before the route
    // because Hono runs handlers in the order they were added.
    app.use('/mcp', async (c, next) => {
      await next()
      seenAuth = c.get('auth')
    })
    app.route('/mcp', mcpRoutes)
  })

  function toolCall(headers: Record<string, string> = {}) {
    return app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...headers,
      },
      body: TOOL_CALL,
    })
  }

  // A bare GET does not exercise the tool-call path. Clients authenticate
  // lazily, so the challenge has to come back from a tool call as well.
  it('answers an unauthenticated tool call with 401, not an MCP tool error', async () => {
    const res = await toolCall()

    expect(res.status).toBe(401)
    expect(mockGetUserPinsWithPagination).not.toHaveBeenCalled()
  })

  it('carries a WWW-Authenticate challenge pointing at the MCP resource metadata', async () => {
    const res = await toolCall()

    expect(res.headers.get('WWW-Authenticate')).toBe(EXPECTED_CHALLENGE)
  })

  it('challenges an invalid token the same way', async () => {
    mockVerifyAccessToken.mockResolvedValue(null)

    const res = await toolCall({ Authorization: 'Bearer pso_bad' })

    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe(EXPECTED_CHALLENGE)
  })

  it('points at the MCP document, not the REST one', async () => {
    const res = await toolCall()

    expect(res.headers.get('WWW-Authenticate')).not.toContain(
      'oauth-protected-resource/api/v1'
    )
  })

  it('hands an authenticated call to the MCP server', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/mcp')
    )
    mockGetUserPinsWithPagination.mockResolvedValue({ pins: [], total: 0 })

    const res = await toolCall({ Authorization: 'Bearer pso_ok' })

    expect(res.status).toBe(200)
    expect(mockGetUserPinsWithPagination).toHaveBeenCalled()
  })

  // The AuthInfo the SDK sees is built from the OAuth principal: the scopes
  // the token was actually granted, and the OAuth client id rather than the
  // user id.
  it('builds AuthInfo from the OAuth principal', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/mcp')
    )
    mockGetUserPinsWithPagination.mockResolvedValue({ pins: [], total: 0 })

    await toolCall({ Authorization: 'Bearer pso_ok' })

    expect(seenAuth).toEqual({
      token: 'pso_ok',
      clientId: 'client-1',
      scopes: ['pins:read', 'tags:read'],
      extra: { user: testUser },
    })
  })

  // Decision 16: the two resources are separate audiences, and the path is
  // what separates them.
  it('rejects a token minted for the REST resource', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/api/v1')
    )

    const res = await toolCall({ Authorization: 'Bearer pso_rest' })

    expect(res.status).toBe(401)
    expect(mockGetUserPinsWithPagination).not.toHaveBeenCalled()
  })

  // `Authorization: Bearer` is the only credential form here. A credential
  // offered in any other header is not one.
  it('ignores a non-bearer credential header', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/mcp')
    )

    const res = await toolCall({ 'X-Custom-Credential': 'anything' })

    expect(res.status).toBe(401)
    expect(mockVerifyAccessToken).not.toHaveBeenCalled()
  })

  // Authenticated, so the point is abuse rather than brute force: a runaway
  // agent must not be able to drive the process on its own.
  it('answers 429 with Retry-After once the per-IP quota is spent', async () => {
    exhaust(mcpLimiter, TEST_CLIENT_IP)

    const res = await toolCall({ Authorization: 'Bearer pso_good' })

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
    expect(mockGetUserPinsWithPagination).not.toHaveBeenCalled()
  })
})
