import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
import { AccessControl, type User, type PinFilter } from '@pinsquirrel/domain'
import {
  pinListInputSchema,
  pinGetInputSchema,
  tagListInputSchema,
  type PinListInput,
} from '@pinsquirrel/services'
import { pinService, tagService } from '../lib/services.js'

function getUserFromExtra(extra: {
  authInfo?: { extra?: Record<string, unknown> }
}): User {
  return extra.authInfo!.extra!.user as User
}

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
    const user = getUserFromExtra(extra)
    const ac = new AccessControl(user)
    const input = args as PinListInput
    const filter: PinFilter = {
      isPrivate: false,
      tag: input.tag,
      search: input.search,
      readLater: input.readLater,
      noTags: input.noTags,
      sortBy: input.sortBy,
      sortDirection: input.sortDirection,
    }
    const result = await pinService.getUserPinsWithPagination(ac, filter, {
      page: input.page,
      pageSize: input.pageSize,
    })
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    }
  }
)

server.registerTool(
  'get_pin',
  {
    title: 'Get Pin',
    description: 'Get a single bookmark by its ID.',
    inputSchema: pinGetInputSchema,
    annotations: { readOnlyHint: true },
  },
  async ({ id }, extra) => {
    const user = getUserFromExtra(extra)
    const ac = new AccessControl(user)
    const pin = await pinService.getPin(ac, id)
    if (pin.isPrivate) {
      return {
        content: [{ type: 'text' as const, text: 'Pin not found' }],
        isError: true,
      }
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(pin) }],
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
    const user = getUserFromExtra(extra)
    const ac = new AccessControl(user)
    const tags = withCounts
      ? await tagService.getUserTagsWithCount(ac, user.id)
      : await tagService.getUserTags(ac, user.id)
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(tags) }],
    }
  }
)

export const mcpTransport = new StreamableHTTPTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,
})

await server.connect(mcpTransport)
