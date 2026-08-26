import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const mockAuthenticate = vi.fn()
const mockHandleRequest = vi.fn()

vi.mock('../lib/services', () => ({
  apiKeyService: {
    authenticate: (...args: unknown[]) => mockAuthenticate(...args) as unknown,
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
    mockAuthenticate.mockResolvedValue(null)

    const res = await toolCall({ Authorization: 'Bearer ps_bad' })

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
    mockAuthenticate.mockResolvedValue({
      user: { id: 'user-1' },
      apiKey: { id: 'key-1' },
    })
    mockHandleRequest.mockResolvedValue(new Response('ok'))

    const res = await toolCall({ Authorization: 'Bearer ps_ok' })

    expect(res.status).toBe(200)
    expect(mockHandleRequest).toHaveBeenCalled()
  })
})
