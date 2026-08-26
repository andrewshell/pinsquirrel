import { describe, it, expect } from 'vitest'
import { splitSearchTerms, escapeLikePattern } from './search-terms.js'

describe('splitSearchTerms', () => {
  it('splits a query on whitespace', () => {
    expect(splitSearchTerms('jesse elder')).toEqual(['jesse', 'elder'])
  })

  it('collapses runs of whitespace and trims the ends', () => {
    expect(splitSearchTerms('  jesse \t\n elder  ')).toEqual(['jesse', 'elder'])
  })

  it('has no terms for a whitespace-only query', () => {
    expect(splitSearchTerms('   ')).toEqual([])
    expect(splitSearchTerms('')).toEqual([])
  })

  it('keeps a single term as one term', () => {
    expect(splitSearchTerms('jesseelder')).toEqual(['jesseelder'])
  })
})

describe('escapeLikePattern', () => {
  it('escapes the LIKE wildcards so they match literally', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%')
    expect(escapeLikePattern('a_c')).toBe('a\\_c')
  })

  it('escapes the backslash before the wildcards it introduces', () => {
    // If `%` were escaped first, the backslash rule would then re-escape the
    // backslash we just added and the pattern would stop matching.
    expect(escapeLikePattern('a\\%')).toBe('a\\\\\\%')
  })

  it('leaves an ordinary term untouched', () => {
    expect(escapeLikePattern('jesse')).toBe('jesse')
  })
})
