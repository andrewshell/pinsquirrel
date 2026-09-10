import { z } from 'zod'
import { pinDescriptionSchema, pinTitleSchema, urlSchema } from './pin.js'

/**
 * Canonical typed-JSON schemas for the pin and tag write operations.
 *
 * The sibling of `pin-query.ts`, and shaped by the same rule: native types in,
 * transport-specific decoding already done. What is different is who reads
 * them. These schemas are handed to the MCP server as tool input schemas, so
 * every `.describe()` here is documentation an agent reads, and the only
 * documentation it gets — there is no README on the other side of the wire.
 *
 * The field validators are the ones the pin form and the importer already use,
 * so a URL the agent may not save is refused by the same rule everywhere. Tag
 * names are the exception: `tagNameSchema` trims and lowercases, and a
 * transform has no JSON Schema to advertise, so the array is typed as plain
 * strings here and normalized by `PinService` on the way in.
 */

const tagNamesDescription =
  'The complete set of tags for this pin. REPLACES the existing tags rather ' +
  'than adding to them, so include every tag the pin should keep. Tag names ' +
  'are trimmed and lowercased. A tag left with no pins is deleted ' +
  'automatically.'

export const pinUpdateInputSchema = z.object({
  id: z.string().describe('The ID of the pin to update'),
  url: urlSchema.optional().describe('New URL for the pin'),
  title: pinTitleSchema.optional().describe('New title for the pin'),
  description: pinDescriptionSchema.describe(
    'New description, or null to clear it'
  ),
  readLater: z.boolean().optional().describe('Mark or unmark as read-later'),
  tagNames: z.array(z.string()).optional().describe(tagNamesDescription),
})

export type PinUpdateInput = z.infer<typeof pinUpdateInputSchema>

export const pinCreateInputSchema = z.object({
  url: urlSchema.describe('The URL to bookmark (http or https)'),
  title: pinTitleSchema.describe('Title for the bookmark'),
  description: pinDescriptionSchema.describe('Optional description'),
  readLater: z
    .boolean()
    .optional()
    .describe('Mark as read-later (default false)'),
  tagNames: z
    .array(z.string())
    .optional()
    .describe(
      'Tags for the new pin. Tag names are trimmed and lowercased, and a ' +
        'tag that does not exist yet is created.'
    ),
})

export type PinCreateInput = z.infer<typeof pinCreateInputSchema>

export const pinDeleteInputSchema = z.object({
  id: z.string().describe('The ID of the pin to delete'),
})

export type PinDeleteInput = z.infer<typeof pinDeleteInputSchema>

export const tagMergeInputSchema = z.object({
  sourceTagIds: z
    .array(z.string())
    .describe(
      'IDs of the tags to fold into the target, as returned by list_tags. ' +
        'At least one, and none of them may be the target.'
    ),
  targetTagId: z
    .string()
    .describe('ID of the tag to keep, as returned by list_tags'),
})

export type TagMergeInput = z.infer<typeof tagMergeInputSchema>

export const tagDeleteInputSchema = z.object({
  id: z
    .string()
    .describe('The ID of the tag to delete, as returned by list_tags'),
})

export type TagDeleteInput = z.infer<typeof tagDeleteInputSchema>
