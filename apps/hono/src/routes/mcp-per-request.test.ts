import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { AccessControl, User } from '@pinsquirrel/domain'

const mockVerifyAccessToken = vi.fn()
const mockGetUserPinsWithPagination = vi.fn()

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

/**
 * The real factory, with every server it hands out written down, so a test can
 * ask what became of them once the response was sent.
 */
const built: McpServer[] = []
vi.mock('../mcp/server', async importOriginal => {
  const actual = await importOriginal<typeof import('../mcp/server')>()
  return {
    createMcpServer: () => {
      const server = actual.createMcpServer()
      built.push(server)
      return server
    },
  }
})

import { mcpLimiter } from '../middleware/rate-limit'
import { TEST_CLIENT_IP } from '../test-support/rate-limit'
import { mcpRoutes } from './mcp'

/**
 * One MCP server and one transport per request.
 *
 * The route used to connect a single `StreamableHTTPTransport` at module load
 * with a `sessionIdGenerator`, which made the process hold exactly one
 * session: the second `initialize` was refused as "Server already
 * initialized", and the one transport mapped every response back to an HTTP
 * request by JSON-RPC id alone, so two callers who both numbered a request `1`
 * could be handed each other's answer. What replaced it has to serve more than
 * one client and has to let go of what it built, so both are asserted here.
 */

const alice = {
  id: 'user-alice',
  username: 'alice',
  roles: [],
} as unknown as User
const bob = { id: 'user-bob', username: 'bob', roles: [] } as unknown as User

const principals: Record<string, User> = {
  pso_alice: alice,
  pso_bob: bob,
}

interface JsonRpcResponse {
  result?: { content?: { text: string }[]; serverInfo?: { name: string } }
  error?: { message: string }
}

let app: Hono

beforeEach(() => {
  vi.resetAllMocks()
  built.length = 0
  mcpLimiter.reset(TEST_CLIENT_IP)
  app = new Hono()
  app.route('/mcp', mcpRoutes)

  mockVerifyAccessToken.mockImplementation((raw: string) => {
    const user = principals[raw]
    return user
      ? {
          token: { id: `token-${user.id}` },
          user,
          clientId: `client-${user.id}`,
          scopes: ['pins:read', 'tags:read'],
        }
      : null
  })
})

/** A request the way a stateless client sends it: no session header. */
async function post(token: string, body: unknown): Promise<Response> {
  return app.request('/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
}

function initialize(token: string): Promise<Response> {
  return post(token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: token, version: '1.0.0' },
    },
  })
}

function listPins(token: string, id: number): Promise<Response> {
  return post(token, {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: 'list_pins', arguments: {} },
  })
}

describe('mcp route with more than one client', () => {
  it('lets a second client initialize', async () => {
    const first = await initialize('pso_alice')
    const second = await initialize('pso_bob')

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const body = (await second.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    expect(body.result?.serverInfo?.name).toBe('pinsquirrel')
  })

  it('serves a tool call from a client that never opened a session', async () => {
    mockGetUserPinsWithPagination.mockResolvedValue({ pins: [], total: 0 })

    const res = await listPins('pso_alice', 7)

    expect(res.status).toBe(200)
    const body = (await res.json()) as JsonRpcResponse
    expect(body.error).toBeUndefined()
    expect(body.result?.content?.[0].text).toBe(
      JSON.stringify({ pins: [], total: 0 })
    )
  })

  // The one that the shared request-id mapping got wrong. Both calls are in
  // flight at once and both are numbered `1`, and the second one to arrive is
  // answered first, so a mapping keyed on the id alone hands at least one of
  // them the wrong user's pins.
  it('answers two concurrent tool calls sharing a JSON-RPC id with their own results', async () => {
    const pending = new Map<string, (result: unknown) => void>()
    mockGetUserPinsWithPagination.mockImplementation(
      (ac: AccessControl) =>
        new Promise(resolve => {
          pending.set(ac.user!.id, resolve)
        })
    )

    const aliceCall = listPins('pso_alice', 1)
    const bobCall = listPins('pso_bob', 1)

    await vi.waitFor(() => expect(pending.size).toBe(2))

    pending.get(bob.id)!({ pins: [{ id: 'pin-bob' }], total: 1 })
    pending.get(alice.id)!({ pins: [{ id: 'pin-alice' }], total: 1 })

    const [aliceBody, bobBody] = (await Promise.all([
      aliceCall.then(res => res.json()),
      bobCall.then(res => res.json()),
    ])) as JsonRpcResponse[]

    expect(aliceBody.result?.content?.[0].text).toContain('pin-alice')
    expect(aliceBody.result?.content?.[0].text).not.toContain('pin-bob')
    expect(bobBody.result?.content?.[0].text).toContain('pin-bob')
    expect(bobBody.result?.content?.[0].text).not.toContain('pin-alice')
  })
})

/**
 * A server per request only stays affordable if the request lets go of it.
 * `isConnected()` reports whether a server still holds a transport, which is
 * false once `close()` has run, so it answers "was anything left behind" from
 * outside the route.
 */
describe('mcp route cleanup', () => {
  it('closes the server it built once the response is sent', async () => {
    mockGetUserPinsWithPagination.mockResolvedValue({ pins: [], total: 0 })

    await listPins('pso_alice', 1)

    expect(built).toHaveLength(1)
    expect(built[0].isConnected()).toBe(false)
  })

  it('builds a server per request rather than reusing one', async () => {
    mockGetUserPinsWithPagination.mockResolvedValue({ pins: [], total: 0 })

    await listPins('pso_alice', 1)
    await listPins('pso_bob', 1)

    expect(built).toHaveLength(2)
    expect(built[0]).not.toBe(built[1])
  })

  // The refusal path runs through the same cleanup: the transport throws an
  // HTTPException for a body it will not read, and the server still goes.
  it('closes the server when the transport refuses the request', async () => {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer pso_alice',
      },
      body: 'not json',
    })

    expect(res.status).toBe(415)
    expect(built).toHaveLength(1)
    expect(built[0].isConnected()).toBe(false)
  })
})
