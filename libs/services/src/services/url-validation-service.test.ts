import { describe, it, expect } from 'vitest'
import { UrlValidationService } from './url-validation-service.js'

describe('UrlValidationService', () => {
  describe('isValidUrl', () => {
    it('should validate HTTP URLs', () => {
      expect(UrlValidationService.isValidUrl('http://example.com')).toBe(true)
      expect(UrlValidationService.isValidUrl('http://example.com/path')).toBe(
        true
      )
      expect(UrlValidationService.isValidUrl('http://example.com:8080')).toBe(
        true
      )
    })

    it('should validate HTTPS URLs', () => {
      expect(UrlValidationService.isValidUrl('https://example.com')).toBe(true)
      expect(UrlValidationService.isValidUrl('https://example.com/path')).toBe(
        true
      )
      expect(UrlValidationService.isValidUrl('https://example.com:443')).toBe(
        true
      )
    })

    it('should reject invalid URLs', () => {
      expect(UrlValidationService.isValidUrl('not a url')).toBe(false)
      expect(UrlValidationService.isValidUrl('')).toBe(false)
      expect(UrlValidationService.isValidUrl('ftp://example.com')).toBe(false)
      expect(UrlValidationService.isValidUrl('file:///path')).toBe(false)
    })

    it('should reject non-string inputs', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(UrlValidationService.isValidUrl(null as any)).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(UrlValidationService.isValidUrl(undefined as any)).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(UrlValidationService.isValidUrl(123 as any)).toBe(false)
    })
  })

  describe('validateUrl', () => {
    it('should return valid result for good URLs', () => {
      const result = UrlValidationService.validateUrl('https://example.com')
      expect(result.isValid).toBe(true)
      expect(result.url).toBeInstanceOf(URL)
      expect(result.url?.href).toBe('https://example.com/')
      expect(result.error).toBeUndefined()
    })

    it('should return detailed error for invalid URLs', () => {
      const result = UrlValidationService.validateUrl('not a url')
      expect(result.isValid).toBe(false)
      expect(result.url).toBeUndefined()
      expect(result.error).toBe('Invalid URL format')
    })

    it('should reject empty URLs', () => {
      const result = UrlValidationService.validateUrl('')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL cannot be empty')
    })

    it('should reject whitespace-only URLs', () => {
      const result = UrlValidationService.validateUrl('   ')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL cannot be empty')
    })

    it('should reject unsupported protocols', () => {
      const result = UrlValidationService.validateUrl('ftp://example.com')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe(
        'Unsupported protocol: ftp:. Only HTTP and HTTPS are supported'
      )
    })

    it('should reject URLs without hostname', () => {
      const result = UrlValidationService.validateUrl('http://')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid URL format')
    })

    it('should handle non-string inputs', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = UrlValidationService.validateUrl(null as any)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL is required and must be a string')
    })
  })

  describe('normalizeUrl', () => {
    it('should trim whitespace', () => {
      expect(UrlValidationService.normalizeUrl('  https://example.com  ')).toBe(
        'https://example.com'
      )
    })

    it('should add https protocol if missing', () => {
      expect(UrlValidationService.normalizeUrl('example.com')).toBe(
        'https://example.com'
      )
      expect(UrlValidationService.normalizeUrl('www.example.com/path')).toBe(
        'https://www.example.com/path'
      )
    })

    it('should preserve existing protocols', () => {
      expect(UrlValidationService.normalizeUrl('http://example.com')).toBe(
        'http://example.com'
      )
      expect(UrlValidationService.normalizeUrl('https://example.com')).toBe(
        'https://example.com'
      )
    })
  })

  describe('isSafeForFetching', () => {
    it('should allow public domains', () => {
      expect(
        UrlValidationService.isSafeForFetching(new URL('https://example.com'))
      ).toBe(true)
      expect(
        UrlValidationService.isSafeForFetching(new URL('https://google.com'))
      ).toBe(true)
      expect(
        UrlValidationService.isSafeForFetching(
          new URL('https://subdomain.example.org')
        )
      ).toBe(true)
    })

    it('should block localhost', () => {
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://localhost'))
      ).toBe(false)
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://127.0.0.1'))
      ).toBe(false)
      // IPv6 localhost URL hostname includes brackets
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://[::1]'))
      ).toBe(false)
    })

    it('should block private IP ranges', () => {
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://192.168.1.1'))
      ).toBe(false)
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://10.0.0.1'))
      ).toBe(false)
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://172.16.0.1'))
      ).toBe(false)
    })

    it('should block .local domains', () => {
      expect(
        UrlValidationService.isSafeForFetching(new URL('http://myserver.local'))
      ).toBe(false)
    })
  })

  describe('validatePublicUrl', () => {
    it('should validate safe public URLs', () => {
      const result = UrlValidationService.validatePublicUrl(
        'https://example.com'
      )
      expect(result.isValid).toBe(true)
      expect(result.url).toBeInstanceOf(URL)
    })

    it('should reject localhost URLs', () => {
      const result = UrlValidationService.validatePublicUrl(
        'http://localhost:3000'
      )
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL points to a private or local address')
    })

    it('should reject private IP URLs', () => {
      const result =
        UrlValidationService.validatePublicUrl('http://192.168.1.1')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('URL points to a private or local address')
    })

    it('should inherit validation from base validateUrl', () => {
      const result = UrlValidationService.validatePublicUrl('not a url')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid URL format')
    })
  })
})
