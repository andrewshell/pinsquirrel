import { describe, it, expect } from 'vitest'
import {
  pinFilterFromInput,
  pinListInputSchema,
  tagListInputSchema,
} from './pin-query.js'

describe('pinListInputSchema', () => {
  it('parses empty input', () => {
    expect(pinListInputSchema.parse({})).toEqual({})
  })

  it('accepts a fully typed input', () => {
    const result = pinListInputSchema.parse({
      tag: 'js',
      search: 'react',
      readLater: true,
      noTags: false,
      sortBy: 'title',
      sortDirection: 'asc',
      page: 2,
      pageSize: 10,
    })
    expect(result).toEqual({
      tag: 'js',
      search: 'react',
      readLater: true,
      noTags: false,
      sortBy: 'title',
      sortDirection: 'asc',
      page: 2,
      pageSize: 10,
    })
  })

  it('rejects stringified booleans', () => {
    expect(pinListInputSchema.safeParse({ readLater: 'true' }).success).toBe(
      false
    )
  })

  it('rejects stringified numbers', () => {
    expect(pinListInputSchema.safeParse({ page: '2' }).success).toBe(false)
  })

  it('rejects invalid sortBy', () => {
    expect(pinListInputSchema.safeParse({ sortBy: 'bogus' }).success).toBe(
      false
    )
  })

  it('rejects pageSize over 100', () => {
    expect(pinListInputSchema.safeParse({ pageSize: 500 }).success).toBe(false)
  })

  it('rejects page < 1', () => {
    expect(pinListInputSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('rejects empty tag string', () => {
    expect(pinListInputSchema.safeParse({ tag: '   ' }).success).toBe(false)
  })
})

describe('tagListInputSchema', () => {
  it('accepts withCounts as boolean', () => {
    expect(tagListInputSchema.parse({ withCounts: true }).withCounts).toBe(true)
  })

  it('rejects stringified boolean', () => {
    expect(tagListInputSchema.safeParse({ withCounts: 'true' }).success).toBe(
      false
    )
  })

  it('accepts empty input', () => {
    expect(tagListInputSchema.parse({})).toEqual({})
  })
})

describe('pinFilterFromInput', () => {
  // Both callers — the REST API and the MCP server — are public-only surfaces.
  // Forcing the flag here is what keeps them from drifting apart again.
  it('always excludes private pins', () => {
    expect(pinFilterFromInput({}).isPrivate).toBe(false)
  })

  it('cannot be talked into including private pins', () => {
    const filter = pinFilterFromInput({
      isPrivate: true,
    } as unknown as Parameters<typeof pinFilterFromInput>[0])

    expect(filter.isPrivate).toBe(false)
  })

  it('passes the remaining filters through', () => {
    const filter = pinFilterFromInput({
      tag: 'reading',
      search: 'rust',
      readLater: true,
      noTags: false,
      sortBy: 'title',
      sortDirection: 'asc',
    })

    expect(filter).toMatchObject({
      tag: 'reading',
      search: 'rust',
      readLater: true,
      noTags: false,
      sortBy: 'title',
      sortDirection: 'asc',
    })
  })
})

describe('pinListInputSchema isPrivate', () => {
  it('drops isPrivate rather than honouring it', () => {
    expect(pinListInputSchema.parse({ isPrivate: true })).toEqual({})
  })
})
