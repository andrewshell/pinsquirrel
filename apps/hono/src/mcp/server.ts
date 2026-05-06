import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPTransport } from '@hono/mcp'
import { AccessControl, PinNotFoundError, type User } from '@pinsquirrel/domain'
import {
  pinListInputSchema,
  pinGetInputSchema,
  tagListInputSchema,
  pinFilterFromInput,
  type PinListInput,
} from '@pinsquirrel/services'
import { pinService, tagService } from '../lib/services.js'
import { mapDomainErrorToMcp } from './errors.js'

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
    try {
      const user = getUserFromExtra(extra)
      const ac = new AccessControl(user)
      const input = args as PinListInput
      const result = await pinService.getUserPinsWithPagination(
        ac,
        { ...pinFilterFromInput(input), isPrivate: false },
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
    inputSchema: pinGetInputSchema,
    annotations: { readOnlyHint: true },
  },
  async ({ id }, extra) => {
    try {
      const user = getUserFromExtra(extra)
      const ac = new AccessControl(user)
      const pin = await pinService.getPin(ac, id)
      if (pin.isPrivate) {
        return mapDomainErrorToMcp(new PinNotFoundError(id))
      }
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

export const mcpTransport = new StreamableHTTPTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,
})

await server.connect(mcpTransport)
