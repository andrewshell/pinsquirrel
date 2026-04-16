import { z } from 'zod'
import { booleanFromString, numberFromString } from '../utils/zod-coerce.js'

/**
 * String-coercion variant of pinListInputSchema for use when input
 * arrives as strings (e.g. HTTP query strings). Converts string
 * representations of booleans and numbers to native types.
 */
export const pinListQuerySchema = z.object({
  tag: z.string().trim().min(1).optional().describe('Filter by tag name'),
  search: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Search pins by keyword'),
  readLater: booleanFromString
    .optional()
    .describe('Filter to read-later pins only'),
  noTags: booleanFromString.optional().describe('Filter to pins with no tags'),
  isPrivate: booleanFromString.optional().describe('Filter by private status'),
  sortBy: z.enum(['created', 'title']).optional().describe('Sort field'),
  sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
  page: numberFromString
    .int()
    .min(1)
    .optional()
    .describe('Page number (1-indexed)'),
  pageSize: numberFromString
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Results per page (max 100)'),
})

/**
 * String-coercion variant of tagListInputSchema.
 */
export const tagListQuerySchema = z.object({
  withCounts: booleanFromString
    .optional()
    .describe('Include pin counts per tag'),
})
