import { describe, it, expect } from 'vitest'
import { parsePinFilters, extractFilterParams } from './filter-utils.server'

describe('parsePinFilters', () => {
  it('should return all filter when no unread parameter is present', () => {
    const url = new URL('https://example.com/pins')
    const result = parsePinFilters(url)

    expect(result.filter).toEqual({})
    expect(result.currentFilterType).toBe('all')
    expect(result.activeTag).toBeUndefined()
  })

  it('should return toread filter when unread=true', () => {
    const url = new URL('https://example.com/pins?unread=true')
    const result = parsePinFilters(url)

    expect(result.filter).toEqual({ readLater: true })
    expect(result.currentFilterType).toBe('toread')
    expect(result.activeTag).toBeUndefined()
  })

  it('should return read filter when unread=false', () => {
    const url = new URL('https://example.com/pins?unread=false')
    const result = parsePinFilters(url)

    expect(result.filter).toEqual({ readLater: false })
    expect(result.currentFilterType).toBe('read')
    expect(result.activeTag).toBeUndefined()
  })

  it('should handle tag filtering', () => {
    const url = new URL('https://example.com/pins?tag=work')
    const result = parsePinFilters(url)

    expect(result.filter).toEqual({ tag: 'work' })
    expect(result.currentFilterType).toBe('all')
    expect(result.activeTag).toBe('work')
  })

  it('should handle combined tag and unread filtering', () => {
    const url = new URL('https://example.com/pins?tag=work&unread=false')
    const result = parsePinFilters(url)

    expect(result.filter).toEqual({ tag: 'work', readLater: false })
    expect(result.currentFilterType).toBe('read')
    expect(result.activeTag).toBe('work')
  })

  it('should ignore invalid unread parameter values', () => {
    const url = new URL('https://example.com/pins?unread=invalid')
    const result = parsePinFilters(url)

    expect(result.filter).toEqual({})
    expect(result.currentFilterType).toBe('all')
    expect(result.activeTag).toBeUndefined()
  })

  describe('noTags parameter', () => {
    it('should set noTags filter when notags=true', () => {
      const url = new URL('https://example.com/pins?notags=true')
      const result = parsePinFilters(url)

      expect(result.filter).toEqual({ noTags: true })
      expect(result.currentFilterType).toBe('all')
      expect(result.activeTag).toBeUndefined()
    })

    it('should ignore noTags filter when notags=false', () => {
      const url = new URL('https://example.com/pins?notags=false')
      const result = parsePinFilters(url)

      expect(result.filter).toEqual({})
      expect(result.currentFilterType).toBe('all')
      expect(result.activeTag).toBeUndefined()
    })

    it('should ignore noTags filter when notags parameter is invalid', () => {
      const url = new URL('https://example.com/pins?notags=invalid')
      const result = parsePinFilters(url)

      expect(result.filter).toEqual({})
      expect(result.currentFilterType).toBe('all')
      expect(result.activeTag).toBeUndefined()
    })

    it('should combine noTags with other filters', () => {
      const url = new URL(
        'https://example.com/pins?notags=true&unread=true&search=test'
      )
      const result = parsePinFilters(url)

      expect(result.filter).toEqual({
        noTags: true,
        readLater: true,
        search: 'test',
      })
      expect(result.currentFilterType).toBe('toread')
      expect(result.activeTag).toBeUndefined()
    })
  })
})

describe('extractFilterParams', () => {
  it('should return empty string when no filter parameters present', () => {
    const request = new Request('https://example.com/pins')
    const result = extractFilterParams(request)
    
    expect(result).toBe('')
  })

  it('should extract tag parameter', () => {
    const request = new Request('https://example.com/pins?tag=work')
    const result = extractFilterParams(request)
    
    expect(result).toBe('?tag=work')
  })

  it('should extract unread parameter when true', () => {
    const request = new Request('https://example.com/pins?unread=true')
    const result = extractFilterParams(request)
    
    expect(result).toBe('?unread=true')
  })

  it('should ignore unread parameter when false', () => {
    const request = new Request('https://example.com/pins?unread=false')
    const result = extractFilterParams(request)
    
    expect(result).toBe('')
  })

  it('should extract both tag and unread parameters', () => {
    const request = new Request('https://example.com/pins?tag=work&unread=true')
    const result = extractFilterParams(request)
    
    expect(result).toBe('?tag=work&unread=true')
  })

  it('should ignore other parameters', () => {
    const request = new Request('https://example.com/pins?tag=work&search=test&page=2')
    const result = extractFilterParams(request)
    
    expect(result).toBe('?tag=work')
  })

  it('should ignore unread parameter when not true', () => {
    const request = new Request('https://example.com/pins?tag=work&unread=invalid')
    const result = extractFilterParams(request)
    
    expect(result).toBe('?tag=work')
  })
})
