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
  tag: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  readLater: z.boolean().optional(),
  noTags: z.boolean().optional(),
  sortBy: z.enum(['created', 'title']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export type PinListInput = z.infer<typeof pinListInputSchema>

export const pinGetInputSchema = {
  id: z.string().describe('The pin ID'),
}

export const tagListInputSchema = z.object({
  withCounts: z.boolean().optional(),
})

export type TagListInput = z.infer<typeof tagListInputSchema>
