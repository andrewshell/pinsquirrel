import { describe, it, expect } from 'vitest'
import { InvalidUrlError, UnsupportedProtocolError } from '@pinsquirrel/domain'
import { validateUrlForFetching } from './url.js'

describe('validateUrlForFetching', () => {
  it('should validate and return HTTP URLs', () => {
    const url = validateUrlForFetching('http://example.com')
    expect(url).toBeInstanceOf(URL)
    expect(url.href).toBe('http://example.com/')
    expect(url.protocol).toBe('http:')
  })

  it('should validate and return HTTPS URLs', () => {
    const url = validateUrlForFetching('https://example.com')
    expect(url).toBeInstanceOf(URL)
    expect(url.href).toBe('https://example.com/')
    expect(url.protocol).toBe('https:')
  })

  it('should validate URLs with paths and query parameters', () => {
    const url = validateUrlForFetching('https://example.com/path?query=value')
    expect(url).toBeInstanceOf(URL)
    expect(url.pathname).toBe('/path')
    expect(url.search).toBe('?query=value')
  })

  it('should validate URLs with ports', () => {
    const url1 = validateUrlForFetching('http://example.com:8080')
    expect(url1.port).toBe('8080')

    const url2 = validateUrlForFetching('https://example.com:8443')
    expect(url2.port).toBe('8443')
  })

  it('should validate URLs with subdomains', () => {
    const url = validateUrlForFetching('https://subdomain.example.com/path')
    expect(url.hostname).toBe('subdomain.example.com')
  })

  it('should throw InvalidUrlError for non-string inputs', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateUrlForFetching(null as any)).toThrow(InvalidUrlError)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateUrlForFetching(undefined as any)).toThrow(
      InvalidUrlError
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateUrlForFetching(123 as any)).toThrow(InvalidUrlError)
  })

  it('should throw InvalidUrlError for empty or whitespace strings', () => {
    expect(() => validateUrlForFetching('')).toThrow(InvalidUrlError)
    expect(() => validateUrlForFetching('   ')).toThrow(InvalidUrlError)
    expect(() => validateUrlForFetching('\t\n')).toThrow(InvalidUrlError)
  })

  it('should throw InvalidUrlError for malformed URLs', () => {
    expect(() => validateUrlForFetching('not-a-url')).toThrow(InvalidUrlError)
    expect(() => validateUrlForFetching('://missing-protocol')).toThrow(
      InvalidUrlError
    )
    expect(() => validateUrlForFetching('http://')).toThrow(InvalidUrlError)
    expect(() => validateUrlForFetching('https://')).toThrow(InvalidUrlError)
  })

  it('should throw UnsupportedProtocolError for non-HTTP protocols', () => {
    expect(() => validateUrlForFetching('ftp://example.com')).toThrow(
      UnsupportedProtocolError
    )
    expect(() => validateUrlForFetching('file:///path/to/file')).toThrow(
      UnsupportedProtocolError
    )
    expect(() => validateUrlForFetching('mailto:test@example.com')).toThrow(
      UnsupportedProtocolError
    )
    expect(() => validateUrlForFetching('javascript:alert("xss")')).toThrow(
      UnsupportedProtocolError
    )
    expect(() =>
      validateUrlForFetching('data:text/plain;base64,SGVsbG8=')
    ).toThrow(UnsupportedProtocolError)
  })

  it('should throw InvalidUrlError for URLs without hostname', () => {
    // These should parse as valid URLs but have no hostname
    expect(() => validateUrlForFetching('http:///')).toThrow(InvalidUrlError)
    expect(() => validateUrlForFetching('https:///')).toThrow(InvalidUrlError)
  })

  it('should throw InvalidUrlError for URLs with empty hostname', () => {
    // Some edge cases where URL constructor might succeed but hostname is empty
    expect(() => validateUrlForFetching('http://:8080')).toThrow(
      InvalidUrlError
    )
    expect(() => validateUrlForFetching('https://:443')).toThrow(
      InvalidUrlError
    )
    expect(() => validateUrlForFetching('http://@')).toThrow(InvalidUrlError)
    expect(() => validateUrlForFetching('https://@')).toThrow(InvalidUrlError)
  })

  it('should handle URLs with auth but no hostname properly', () => {
    // URLs with auth info but missing hostname
    expect(() => validateUrlForFetching('http://user:pass@')).toThrow(
      InvalidUrlError
    )
    expect(() => validateUrlForFetching('https://token@')).toThrow(
      InvalidUrlError
    )
  })

  describe('SSRF Protection', () => {
    it('should allow public domains', () => {
      expect(() => validateUrlForFetching('https://example.com')).not.toThrow()
      expect(() => validateUrlForFetching('https://google.com')).not.toThrow()
      expect(() =>
        validateUrlForFetching('https://subdomain.example.org')
      ).not.toThrow()
      expect(() =>
        validateUrlForFetching('http://public-api.service.com')
      ).not.toThrow()
    })

    it('should block localhost variations', () => {
      expect(() => validateUrlForFetching('http://localhost')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://localhost:3000')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('http://LOCALHOST')).toThrow(
        InvalidUrlError
      ) // case insensitive
    })

    it('should block IPv4 localhost', () => {
      expect(() => validateUrlForFetching('http://127.0.0.1')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://127.0.0.1:8080')).toThrow(
        InvalidUrlError
      )
    })

    it('should block IPv6 localhost', () => {
      expect(() => validateUrlForFetching('http://[::1]')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://[::1]:3000')).toThrow(
        InvalidUrlError
      )
    })

    it('should block private IP ranges', () => {
      // 192.168.x.x range
      expect(() => validateUrlForFetching('http://192.168.1.1')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://192.168.0.100')).toThrow(
        InvalidUrlError
      )

      // 10.x.x.x range
      expect(() => validateUrlForFetching('http://10.0.0.1')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://10.1.1.1')).toThrow(
        InvalidUrlError
      )

      // 172.16-31.x.x range (basic check for 172.x.x.x)
      expect(() => validateUrlForFetching('http://172.16.0.1')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://172.20.1.1')).toThrow(
        InvalidUrlError
      )
    })

    it('should block .local domains', () => {
      expect(() => validateUrlForFetching('http://myserver.local')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('https://printer.local')).toThrow(
        InvalidUrlError
      )
      expect(() => validateUrlForFetching('http://device.home.local')).toThrow(
        InvalidUrlError
      )
    })

    it('should allow domains that contain blocked words but are not actually blocked', () => {
      // These should be allowed - they contain "local" but don't end with .local
      expect(() =>
        validateUrlForFetching('https://localhost-api.example.com')
      ).not.toThrow()
      expect(() =>
        validateUrlForFetching('http://localized.service.com')
      ).not.toThrow()

      // These should be allowed - they contain IP-like numbers but aren't actually private IPs
      expect(() =>
        validateUrlForFetching('https://192168.example.com')
      ).not.toThrow()
      expect(() =>
        validateUrlForFetching('http://version10.service.com')
      ).not.toThrow()
    })
  })

  describe('Error messages', () => {
    it('should include the URL in InvalidUrlError', () => {
      try {
        validateUrlForFetching('not-a-url')
        expect.fail('Should have thrown InvalidUrlError')
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidUrlError)
        expect((error as InvalidUrlError).message).toContain('not-a-url')
      }
    })

    it('should include the protocol in UnsupportedProtocolError', () => {
      try {
        validateUrlForFetching('ftp://example.com')
        expect.fail('Should have thrown UnsupportedProtocolError')
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedProtocolError)
        expect((error as UnsupportedProtocolError).message).toContain('ftp:')
      }
    })
  })
})
