import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { User } from '@pinsquirrel/domain'

const mockVerifyAccessToken = vi.fn()
const mockHandleRequest = vi.fn()

vi.mock('../lib/services', () => ({
  oauthService: {
    verifyAccessToken: (...args: unknown[]) =>
      mockVerifyAccessToken(...args) as unknown,
  },
}))

vi.mock('../mcp/server', () => ({
  mcpTransport: {
    handleRequest: (...args: unknown[]) =>
      mockHandleRequest(...args) as unknown,
  },
}))

import { mcpRoutes } from './mcp'

const TOOL_CALL = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'list_pins', arguments: {} },
})

const EXPECTED_CHALLENGE =
  'Bearer resource_metadata="http://localhost:8100/.well-known/oauth-protected-resource/mcp", scope="pins:read tags:read"'

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

  beforeEach(() => {
    vi.resetAllMocks()
    app = new Hono()
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
    expect(mockHandleRequest).not.toHaveBeenCalled()
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

  it('hands an authenticated call to the transport', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/mcp')
    )
    mockHandleRequest.mockResolvedValue(new Response('ok'))

    const res = await toolCall({ Authorization: 'Bearer pso_ok' })

    expect(res.status).toBe(200)
    expect(mockHandleRequest).toHaveBeenCalled()
  })

  // The AuthInfo the SDK sees is built from the OAuth principal: real scopes
  // rather than the empty array the key path carried, and the OAuth client id
  // rather than the user id.
  it('builds AuthInfo from the OAuth principal', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/mcp')
    )
    let seen: unknown
    mockHandleRequest.mockImplementation(
      (c: { get: (k: string) => unknown }) => {
        seen = c.get('auth')
        return new Response('ok')
      }
    )

    await toolCall({ Authorization: 'Bearer pso_ok' })

    expect(seen).toEqual({
      token: 'pso_ok',
      clientId: 'client-1',
      scopes: ['pins:read', 'tags:read'],
      extra: { user: testUser },
    })
  })

  // Decision 18: the two resources are separate audiences, and the path is
  // what separates them.
  it('rejects a token minted for the REST resource', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/api/v1')
    )

    const res = await toolCall({ Authorization: 'Bearer pso_rest' })

    expect(res.status).toBe(401)
    expect(mockHandleRequest).not.toHaveBeenCalled()
  })

  // X-API-Key went with the API keys. Authorization: Bearer is the only
  // credential form here now.
  it('rejects an X-API-Key header', async () => {
    mockVerifyAccessToken.mockImplementation(
      tokenFor('http://localhost:8100/mcp')
    )

    const res = await toolCall({ 'X-API-Key': 'ps_ok' })

    expect(res.status).toBe(401)
    expect(mockVerifyAccessToken).not.toHaveBeenCalled()
  })
})
