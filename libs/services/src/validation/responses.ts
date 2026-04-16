import { z } from 'zod'
import {
  urlSchema,
  pinTitleSchema,
  pinDescriptionSchema,
  tagNameSchema,
} from './pin.js'

/**
 * Zod schemas describing the shapes that services return.
 * Used for OpenAPI spec generation and documentation.
 *
 * Dates are represented as ISO 8601 strings because that is the
 * JSON wire format produced by JSON.stringify(Date).
 */

export const pinSchema = z
  .object({
    id: z.string().describe('Unique pin identifier'),
    userId: z.string().describe('Owner user ID'),
    url: urlSchema.describe('Bookmarked URL'),
    title: pinTitleSchema.describe('Pin title'),
    description: pinDescriptionSchema.describe('Optional description'),
    readLater: z.boolean().describe('Marked for reading later'),
    isPrivate: z.boolean().describe('Whether the pin is private'),
    tagNames: z.array(tagNameSchema).describe('Associated tag names'),
    createdAt: z.string().datetime().describe('Creation timestamp (ISO 8601)'),
    updatedAt: z
      .string()
      .datetime()
      .describe('Last update timestamp (ISO 8601)'),
  })
  .describe('A bookmarked pin')

export const tagSchema = z
  .object({
    id: z.string().describe('Unique tag identifier'),
    userId: z.string().describe('Owner user ID'),
    name: z.string().describe('Tag name'),
    createdAt: z.string().datetime().describe('Creation timestamp (ISO 8601)'),
    updatedAt: z
      .string()
      .datetime()
      .describe('Last update timestamp (ISO 8601)'),
  })
  .describe('A tag')

export const tagWithCountSchema = tagSchema
  .extend({
    pinCount: z.number().int().min(0).describe('Number of pins with this tag'),
  })
  .describe('A tag with pin count')

export const paginationSchema = z
  .object({
    totalCount: z.number().int().min(0).describe('Total number of results'),
    page: z.number().int().min(1).describe('Current page number'),
    pageSize: z.number().int().min(1).describe('Results per page'),
    offset: z.number().int().min(0).describe('Offset into result set'),
    totalPages: z.number().int().min(1).describe('Total number of pages'),
    hasNext: z.boolean().describe('Whether a next page exists'),
    hasPrevious: z.boolean().describe('Whether a previous page exists'),
  })
  .describe('Pagination metadata')

export const paginatedPinsSchema = z
  .object({
    pins: z.array(pinSchema).describe('List of pins'),
    pagination: paginationSchema,
  })
  .describe('Paginated list of pins')

export const errorSchema = z
  .object({
    error: z.string().describe('Error message'),
  })
  .describe('Error response')
