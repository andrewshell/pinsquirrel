import { z } from 'zod'
import type {
  Pin,
  Tag,
  TagWithCount,
  Pagination,
  Jsonify,
} from '@pinsquirrel/domain'

/**
 * Zod schemas describing the shapes that services return.
 * Used for OpenAPI spec generation and documentation.
 *
 * Each schema is anchored to its domain type via `z.ZodType<Jsonify<T>>`,
 * so adding a field to a domain entity will fail the build here until
 * the wire-format schema is updated. Dates are represented as ISO 8601
 * strings because that is the JSON wire format produced by
 * `JSON.stringify(Date)`.
 */

export const pinSchema: z.ZodType<Jsonify<Pin>> = z
  .object({
    id: z.string().describe('Unique pin identifier'),
    userId: z.string().describe('Owner user ID'),
    url: z.string().describe('Bookmarked URL'),
    title: z.string().describe('Pin title'),
    description: z.string().nullable().describe('Optional description'),
    readLater: z.boolean().describe('Marked for reading later'),
    isPrivate: z.boolean().describe('Whether the pin is private'),
    tagNames: z.array(z.string()).describe('Associated tag names'),
    createdAt: z.string().datetime().describe('Creation timestamp (ISO 8601)'),
    updatedAt: z
      .string()
      .datetime()
      .describe('Last update timestamp (ISO 8601)'),
  })
  .describe('A bookmarked pin')

export const tagSchema: z.ZodType<Jsonify<Tag>> = z
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

export const tagWithCountSchema: z.ZodType<Jsonify<TagWithCount>> = z
  .object({
    id: z.string().describe('Unique tag identifier'),
    userId: z.string().describe('Owner user ID'),
    name: z.string().describe('Tag name'),
    pinCount: z.number().int().min(0).describe('Number of pins with this tag'),
    createdAt: z.string().datetime().describe('Creation timestamp (ISO 8601)'),
    updatedAt: z
      .string()
      .datetime()
      .describe('Last update timestamp (ISO 8601)'),
  })
  .describe('A tag with pin count')

export const paginationSchema: z.ZodType<Jsonify<Pagination>> = z
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

export interface PaginatedPins {
  pins: Pin[]
  pagination: Pagination
}

export const paginatedPinsSchema: z.ZodType<Jsonify<PaginatedPins>> = z
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
