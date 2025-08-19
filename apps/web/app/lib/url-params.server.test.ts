import { describe, it, expect } from 'vitest'
import { extractUrlParams } from './url-params.server'

describe('extractUrlParams', () => {
  it('returns null when no URL parameters are present', () => {
    const request = new Request('http://localhost:3000/testuser/pins/new')
    const result = extractUrlParams(request)
    expect(result).toBeNull()
  })

  it('extracts URL parameters correctly', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?url=https%3A//example.com&title=Test%20Title&description=Test%20description'
    )
    const result = extractUrlParams(request)

    expect(result).toEqual({
      url: 'https://example.com',
      title: 'Test Title',
      description: 'Test description',
    })
  })

  it('handles partial parameters', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?url=https%3A//example.com&title=Test%20Title'
    )
    const result = extractUrlParams(request)

    expect(result).toEqual({
      url: 'https://example.com',
      title: 'Test Title',
      description: '',
    })
  })

  it('sanitizes invalid URLs', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?url=javascript%3Aalert%28%27xss%27%29&title=Test'
    )
    const result = extractUrlParams(request)

    expect(result?.url).toBe('') // Invalid URL should be empty
    expect(result?.title).toBe('Test')
  })

  it('removes HTML tags from text parameters', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?title=%3Cscript%3Ealert%28%27xss%27%29%3C%2Fscript%3EClean%20Title&description=Normal%20%3Cb%3Ebold%3C%2Fb%3E%20text'
    )
    const result = extractUrlParams(request)

    expect(result?.title).toBe("alert('xss')Clean Title") // HTML tags stripped
    expect(result?.description).toBe('Normal bold text') // HTML tags stripped
  })

  it('decodes HTML entities', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?title=Title%20with%20%26amp%3B%20%26lt%3B%20%26gt%3B&description=Description%20with%20%26quot%3B%20%26%2339%3B'
    )
    const result = extractUrlParams(request)

    expect(result?.title).toBe('Title with & < >')
    expect(result?.description).toBe('Description with " \'')
  })

  it('truncates overly long text', () => {
    const longTitle = 'a'.repeat(1000)
    const longDescription = 'b'.repeat(5000)

    const request = new Request(
      `http://localhost:3000/testuser/pins/new?title=${encodeURIComponent(longTitle)}&description=${encodeURIComponent(longDescription)}`
    )
    const result = extractUrlParams(request)

    expect(result?.title).toHaveLength(500) // Should be truncated
    expect(result?.description).toHaveLength(2000) // Should be truncated
  })

  it('handles encoded special characters in URLs', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?url=https%3A//example.com/path%3Fquery%3Dvalue%26another%3Dvalue'
    )
    const result = extractUrlParams(request)

    expect(result?.url).toBe(
      'https://example.com/path?query=value&another=value'
    )
  })

  it('handles newlines in description', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?description=Line%20one%0ALine%20two%0A%0ALine%20four'
    )
    const result = extractUrlParams(request)

    expect(result?.description).toBe('Line one\nLine two\n\nLine four')
  })

  it('handles empty parameter values', () => {
    const request = new Request(
      'http://localhost:3000/testuser/pins/new?url=&title=&description='
    )
    const result = extractUrlParams(request)

    expect(result).toEqual({
      url: '',
      title: '',
      description: '',
    })
  })

  it('validates URLs correctly', () => {
    const validUrls = [
      'https://example.com',
      'http://example.com',
      'https://example.com/path?query=value',
      'https://subdomain.example.com/path',
    ]

    const invalidUrls = [
      'not-a-url',
      'javascript:alert("xss")',
      'ftp://example.com', // Only http/https allowed
      '',
    ]

    for (const url of validUrls) {
      const request = new Request(
        `http://localhost:3000/testuser/pins/new?url=${encodeURIComponent(url)}`
      )
      const result = extractUrlParams(request)
      expect(result?.url).toBe(url)
    }

    for (const url of invalidUrls) {
      const request = new Request(
        `http://localhost:3000/testuser/pins/new?url=${encodeURIComponent(url)}`
      )
      const result = extractUrlParams(request)
      expect(result?.url).toBe('')
    }
  })
})
