import { describe, it, expect } from 'vitest'
import { pinListInputSchema, tagListInputSchema } from './pin-query.js'

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
