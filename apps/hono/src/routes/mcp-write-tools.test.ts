import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  DuplicatePinError,
  PinNotFoundError,
  type User,
} from '@pinsquirrel/domain'

const mockVerifyAccessToken = vi.fn()
const mockUpdatePublicPin = vi.fn()
const mockCreatePin = vi.fn()
const mockDeletePublicPin = vi.fn()

/**
 * The write tools, driven the way a client drives them: JSON-RPC in over
 * `/mcp`, JSON-RPC out, with the services standing in for the world below.
 *
 * Same seam as `mcp.test.ts` — the route builds its own server and transport,
 * so there is nothing to mock by name — but the question here is different.
 * That file asks who gets through the door; this one asks what a tool does
 * once it is inside, and above all whether a connection that was never granted
 * a write scope can write. Whether the mocked service ran is the answer to
 * both halves of that.
 */
vi.mock('../lib/services', () => ({
  oauthService: {
    verifyAccessToken: (...args: unknown[]) =>
      mockVerifyAccessToken(...args) as unknown,
  },
  pinService: {
    getUserPinsWithPagination: vi.fn(),
    getPublicPin: vi.fn(),
    updatePublicPin: (...args: unknown[]) =>
      mockUpdatePublicPin(...args) as unknown,
    createPin: (...args: unknown[]) => mockCreatePin(...args) as unknown,
    deletePublicPin: (...args: unknown[]) =>
      mockDeletePublicPin(...args) as unknown,
  },
  tagService: {
    getUserTags: vi.fn(),
    getUserTagsWithCount: vi.fn(),
  },
}))

import { mcpLimiter } from '../middleware/rate-limit'
import { TEST_CLIENT_IP } from '../test-support/rate-limit'
import { mcpRoutes } from './mcp'

const testUser = { id: 'user-1', username: 'alice' } as unknown as User

const READ_ONLY = ['pins:read', 'tags:read']
const FULL = ['pins:read', 'tags:read', 'pins:write', 'tags:write']

interface ToolResult {
  isError?: boolean
  content: { type: string; text: string }[]
}

describe('mcp write tools', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    mcpLimiter.reset(TEST_CLIENT_IP)
    app = new Hono()
    app.route('/mcp', mcpRoutes)
  })

  /** A valid token for `/mcp` carrying exactly the scopes a case grants. */
  function granted(scopes: string[]) {
    mockVerifyAccessToken.mockResolvedValue({
      token: { id: 'token-1' },
      user: testUser,
      clientId: 'client-1',
      scopes,
    })
  }

  async function callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer pso_ok',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { result?: ToolResult; error?: unknown }
    expect(body.error).toBeUndefined()
    return body.result as ToolResult
  }

  describe('update_pin', () => {
    // The scope is the whole point of Phase 8. A read-only connection reaching
    // a service here would mean the guard is decorative.
    it('refuses a connection that was not granted pins:write', async () => {
      granted(READ_ONLY)

      const result = await callTool('update_pin', {
        id: 'pin-1',
        tagNames: ['rust'],
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('pins:write')
      expect(mockUpdatePublicPin).not.toHaveBeenCalled()
    })

    it('updates through the public-only service method and returns the pin', async () => {
      granted(FULL)
      const pin = { id: 'pin-1', title: 'Example', tagNames: ['rust'] }
      mockUpdatePublicPin.mockResolvedValue(pin)

      const result = await callTool('update_pin', {
        id: 'pin-1',
        tagNames: ['rust'],
      })

      expect(result.isError).toBeFalsy()
      expect(JSON.parse(result.content[0].text)).toMatchObject(pin)
      // The user comes from the token, never from the arguments.
      expect(mockUpdatePublicPin).toHaveBeenCalledWith(expect.anything(), {
        id: 'pin-1',
        userId: 'user-1',
        tagNames: ['rust'],
      })
    })
  })

  describe('create_pin', () => {
    it('refuses a connection that was not granted pins:write', async () => {
      granted(READ_ONLY)

      const result = await callTool('create_pin', {
        url: 'https://example.com',
        title: 'Example',
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('pins:write')
      expect(mockCreatePin).not.toHaveBeenCalled()
    })

    it('creates the pin for the token’s user and returns it', async () => {
      granted(FULL)
      const pin = { id: 'pin-9', url: 'https://example.com', title: 'Example' }
      mockCreatePin.mockResolvedValue(pin)

      const result = await callTool('create_pin', {
        url: 'https://example.com',
        title: 'Example',
        tagNames: ['rust'],
      })

      expect(result.isError).toBeFalsy()
      expect(JSON.parse(result.content[0].text)).toMatchObject(pin)
      // Public, said out loud rather than left to a default: this surface
      // only ever reads public pins, so it must not create one it could not
      // then read back.
      expect(mockCreatePin).toHaveBeenCalledWith(expect.anything(), {
        userId: 'user-1',
        url: 'https://example.com',
        title: 'Example',
        description: null,
        readLater: false,
        isPrivate: false,
        tagNames: ['rust'],
      })
    })

    // Without a mapping this came back as "Internal server error", which an
    // agent answers by trying the same call again.
    it('names the existing pin when the URL is already saved', async () => {
      granted(FULL)
      mockCreatePin.mockRejectedValue(
        new DuplicatePinError('https://example.com', {
          id: 'pin-1',
          createdAt: new Date('2024-01-01'),
        })
      )

      const result = await callTool('create_pin', {
        url: 'https://example.com',
        title: 'Example',
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('pin-1')
      expect(result.content[0].text).toContain('update_pin')
    })
  })

  describe('delete_pin', () => {
    it('refuses a connection that was not granted pins:write', async () => {
      granted(READ_ONLY)

      const result = await callTool('delete_pin', { id: 'pin-1' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('pins:write')
      expect(mockDeletePublicPin).not.toHaveBeenCalled()
    })

    it('deletes through the public-only service method', async () => {
      granted(FULL)
      mockDeletePublicPin.mockResolvedValue(undefined)

      const result = await callTool('delete_pin', { id: 'pin-1' })

      expect(result.isError).toBeFalsy()
      expect(mockDeletePublicPin).toHaveBeenCalledWith(
        expect.anything(),
        'pin-1'
      )
    })

    // The service reports a private, foreign or missing pin the same way, and
    // the tool must not turn that into a stack trace.
    it('reports a pin it may not touch as not found', async () => {
      granted(FULL)
      mockDeletePublicPin.mockRejectedValue(new PinNotFoundError('pin-1'))

      const result = await callTool('delete_pin', { id: 'pin-1' })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Pin not found')
    })
  })
})
