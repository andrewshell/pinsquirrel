import { z } from 'zod'

/**
 * Canonical typed-JSON schemas for pin/tag list input.
 *
 * These schemas represent the "logical" shape of list-query input after
 * any transport-specific decoding (e.g. REST query-string coercion) has
 * already happened. Services, MCP tool handlers, and any other caller
 * should hand these schemas values with native types — booleans as
 * booleans, numbers as numbers.
 */

export const pinListInputSchema = z.object({
  tag: z.string().trim().min(1).optional().describe('Filter by tag name'),
  search: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Search pins by keyword'),
  readLater: z.boolean().optional().describe('Filter to read-later pins only'),
  noTags: z.boolean().optional().describe('Filter to pins with no tags'),
  isPrivate: z.boolean().optional().describe('Filter by private status'),
  sortBy: z.enum(['created', 'title']).optional().describe('Sort field'),
  sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: z.number().int().min(1).optional().describe('Page number (1-indexed)'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Results per page (max 100)'),
})

export type PinListInput = z.infer<typeof pinListInputSchema>

export const pinGetInputSchema = {
  id: z.string().describe('The pin ID'),
}

export const tagListInputSchema = z.object({
  withCounts: z.boolean().optional().describe('Include pin counts per tag'),
})

export type TagListInput = z.infer<typeof tagListInputSchema>
