import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { AccessControl, type User } from '@pinsquirrel/domain'
import {
  pinListInputSchema,
  pinGetInputSchema,
  pinUpdateInputSchema,
  tagListInputSchema,
  pinFilterFromInput,
  type PinListInput,
  type PinUpdateInput,
} from '@pinsquirrel/services'
import { pinService, tagService } from '../lib/services.js'
import { mapDomainErrorToMcp } from './errors.js'
import { requireScope } from './scopes.js'

function getUserFromExtra(extra: {
  authInfo?: { extra?: Record<string, unknown> }
}): User {
  return extra.authInfo!.extra!.user as User
}

/**
 * Build a fresh MCP server with the read-only tools registered.
 *
 * A factory rather than a module-level instance because `/mcp` builds one per
 * request (see `routes/mcp.ts`): a server shared across callers is a session
 * shared across callers, and this process serves every client at once.
 *
 * Every tool here is a read and so requires no scope beyond a valid token. A
 * write tool calls `requireScope(extra, 'pins:write')` from `./scopes.js`
 * before it touches a service, and lets `mapDomainErrorToMcp` turn the refusal
 * into a tool error.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'pinsquirrel',
    version: '1.0.0',
  })

  server.registerTool(
    'list_pins',
    {
      title: 'List Pins',
      description:
        'List and search bookmarks with filtering and pagination. Returns pins sorted by creation date (newest first) by default.',
      inputSchema: pinListInputSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      try {
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        const input = args as PinListInput
        const result = await pinService.getUserPinsWithPagination(
          ac,
          pinFilterFromInput(input),
          { page: input.page, pageSize: input.pageSize }
        )
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  server.registerTool(
    'get_pin',
    {
      title: 'Get Pin',
      description: 'Get a single bookmark by its ID.',
      inputSchema: pinGetInputSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async ({ id }, extra) => {
      try {
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        const pin = await pinService.getPublicPin(ac, id)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pin) }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  server.registerTool(
    'list_tags',
    {
      title: 'List Tags',
      description: 'List your tags, optionally with bookmark counts per tag.',
      inputSchema: tagListInputSchema.shape,
      annotations: { readOnlyHint: true },
    },
    async ({ withCounts }, extra) => {
      try {
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        const tags = withCounts
          ? await tagService.getUserTagsWithCount(ac, user.id)
          : await tagService.getUserTags(ac, user.id)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(tags) }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  server.registerTool(
    'update_pin',
    {
      title: 'Update Pin',
      description:
        'Update a bookmark. This is the retagging tool: tagNames REPLACES ' +
        "the pin's tags rather than adding to them, and any field you omit " +
        'is left unchanged. A tag that ends up with no pins is deleted ' +
        'automatically, so moving a pin off a one-pin tag needs no ' +
        'delete_tag call afterwards. Requires the pins:write scope.',
      inputSchema: pinUpdateInputSchema.shape,
      // Idempotent because sending the same fields again lands the pin in the
      // same state. Not destructive: nothing here removes a pin, and the tags
      // it drops are the caller's own instruction.
      annotations: { idempotentHint: true },
    },
    async (args, extra) => {
      try {
        requireScope(extra, 'pins:write')
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        const input = args as PinUpdateInput
        const pin = await pinService.updatePublicPin(ac, {
          ...input,
          userId: user.id,
        })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pin) }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  return server
}
