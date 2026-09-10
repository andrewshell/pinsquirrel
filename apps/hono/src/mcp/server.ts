import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { AccessControl, type User } from '@pinsquirrel/domain'
import {
  pinListInputSchema,
  pinGetInputSchema,
  pinCreateInputSchema,
  pinDeleteInputSchema,
  pinUpdateInputSchema,
  tagListInputSchema,
  tagMergeInputSchema,
  tagDeleteInputSchema,
  pinFilterFromInput,
  type PinCreateInput,
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
 * Build a fresh MCP server with the pin and tag tools registered.
 *
 * A factory rather than a module-level instance because `/mcp` builds one per
 * request (see `routes/mcp.ts`): a server shared across callers is a session
 * shared across callers, and this process serves every client at once.
 *
 * The three reads need no scope beyond a valid token. Each write calls
 * `requireScope(extra, …)` from `./scopes.js` before it touches a service,
 * inside the same `try`, so the refusal travels back through
 * `mapDomainErrorToMcp` as a tool error the model can act on rather than as a
 * transport failure it will retry.
 *
 * Every tool is a public-pins-only surface, reads and writes alike:
 * `pinFilterFromInput` forces `isPrivate: false`, `get_pin` goes through
 * `getPublicPin`, and the writes go through `updatePublicPin` /
 * `deletePublicPin`, which resolve a pin the same way. A private pin a client
 * cannot see is one it cannot change or delete either, and `create_pin` cannot
 * make one. That rule lives in `PinService`, not here - a transport deciding
 * for itself which pins it may touch is how the REST API once listed private
 * pins.
 *
 * The descriptions are written for the job these tools exist for: an agent
 * consolidating a library of one- and two-pin tags. They are the only
 * documentation it reads.
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
        'List and search bookmarks with filtering and pagination. Returns ' +
        'pins sorted by creation date (newest first) by default. Set ' +
        'noTags: true to find the pins that carry no tags at all, which is ' +
        'where a retagging pass starts.',
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
      description:
        'List your tags. Set withCounts: true for the number of bookmarks ' +
        'on each, which is how to find the tags holding only one or two pins ' +
        'and worth consolidating. The IDs it returns are what merge_tags and ' +
        'delete_tag take.',
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

  server.registerTool(
    'create_pin',
    {
      title: 'Create Pin',
      description:
        'Save a new bookmark. Fails if you have already saved this URL; the ' +
        'error names the existing pin, which update_pin can change. New ' +
        'pins are public. Requires the pins:write scope.',
      inputSchema: pinCreateInputSchema.shape,
      annotations: {},
    },
    async (args, extra) => {
      try {
        requireScope(extra, 'pins:write')
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        const input = args as PinCreateInput
        // `isPrivate` is not in the input and is set here rather than left to
        // the service's default: this surface exposes public pins only, so it
        // must not create one it could not then read back.
        const pin = await pinService.createPin(ac, {
          userId: user.id,
          url: input.url,
          title: input.title,
          description: input.description ?? null,
          readLater: input.readLater ?? false,
          isPrivate: false,
          tagNames: input.tagNames ?? [],
        })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(pin) }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  server.registerTool(
    'delete_pin',
    {
      title: 'Delete Pin',
      description:
        'Delete a bookmark permanently. Any tag left with no pins goes with ' +
        'it. Requires the pins:write scope.',
      inputSchema: pinDeleteInputSchema.shape,
      annotations: { destructiveHint: true },
    },
    async ({ id }, extra) => {
      try {
        requireScope(extra, 'pins:write')
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        await pinService.deletePublicPin(ac, id)
        return {
          content: [{ type: 'text' as const, text: `Deleted pin ${id}.` }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  server.registerTool(
    'merge_tags',
    {
      title: 'Merge Tags',
      description:
        'Fold one or more tags into another. Every pin carrying a source tag ' +
        'gets the target tag, and the source tags are deleted. This is the ' +
        'way to consolidate: take the tag IDs from list_tags (not the names), ' +
        'and do not name the target among the sources. Requires the ' +
        'tags:write scope.',
      inputSchema: tagMergeInputSchema.shape,
      annotations: { destructiveHint: true },
    },
    async ({ sourceTagIds, targetTagId }, extra) => {
      try {
        requireScope(extra, 'tags:write')
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        await tagService.mergeTags(ac, sourceTagIds, targetTagId)
        return {
          content: [
            {
              type: 'text' as const,
              text: `Merged ${sourceTagIds.length} tag(s) into ${targetTagId}.`,
            },
          ],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  server.registerTool(
    'delete_tag',
    {
      title: 'Delete Tag',
      description:
        'Delete a tag, by ID as returned by list_tags. The pins keep their ' +
        'other tags. Rarely needed while retagging: a tag left with no pins ' +
        'is deleted automatically. Requires the tags:write scope.',
      inputSchema: tagDeleteInputSchema.shape,
      annotations: { destructiveHint: true },
    },
    async ({ id }, extra) => {
      try {
        requireScope(extra, 'tags:write')
        const user = getUserFromExtra(extra)
        const ac = new AccessControl(user)
        await tagService.deleteTag(ac, id)
        return {
          content: [{ type: 'text' as const, text: `Deleted tag ${id}.` }],
        }
      } catch (err) {
        return mapDomainErrorToMcp(err)
      }
    }
  )

  return server
}
