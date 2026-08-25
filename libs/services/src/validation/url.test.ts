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
    /**
     * Assert the guard refused a URL the parser accepts.
     *
     * Everything this function rejects is an `InvalidUrlError`, so asserting
     * only the class lets a case pass for the wrong reason — a typo in the
     * fixture would be rejected by `new URL` and look like a working block.
     * Parsing it here first means the rejection can only be the SSRF rule.
     */
    const expectBlocked = (urlString: string): void => {
      expect(new URL(urlString).hostname).not.toBe('')
      expect(() => validateUrlForFetching(urlString)).toThrow(InvalidUrlError)
    }

    /** Assert the guard let a URL through, and returned that same host. */
    const expectAllowed = (urlString: string, hostname: string): void => {
      expect(validateUrlForFetching(urlString).hostname).toBe(hostname)
    }

    it.each([
      ['https://example.com', 'example.com'],
      ['https://google.com', 'google.com'],
      ['https://subdomain.example.org', 'subdomain.example.org'],
      ['http://public-api.service.com', 'public-api.service.com'],
    ])('should allow the public domain %s', (url, hostname) => {
      expectAllowed(url, hostname)
    })

    it('should block localhost variations', () => {
      expectBlocked('http://localhost')
      expectBlocked('https://localhost:3000')
      expectBlocked('http://LOCALHOST') // case insensitive
    })

    it('should block IPv4 localhost', () => {
      expectBlocked('http://127.0.0.1')
      expectBlocked('https://127.0.0.1:8080')
    })

    it('should block IPv6 localhost', () => {
      expectBlocked('http://[::1]')
      expectBlocked('https://[::1]:3000')
    })

    it('should block private IP ranges', () => {
      // 192.168.x.x range
      expectBlocked('http://192.168.1.1')
      expectBlocked('https://192.168.0.100')

      // 10.x.x.x range
      expectBlocked('http://10.0.0.1')
      expectBlocked('https://10.1.1.1')

      // 172.16-31.x.x range
      expectBlocked('http://172.16.0.1')
      expectBlocked('https://172.20.1.1')
    })

    it.each([
      ['0.0.0.0', 'this host'],
      ['0.1.2.3', '0.0.0.0/8'],
      ['169.254.169.254', 'cloud metadata (169.254.0.0/16)'],
      ['169.254.0.1', 'link-local'],
      ['127.1.2.3', '127.0.0.0/8, not just 127.0.0.1'],
      ['172.31.255.255', 'top of 172.16.0.0/12'],
    ])('should block %s (%s)', address => {
      expectBlocked(`http://${address}`)
    })

    it.each([
      ['172.15.0.1', 'below 172.16.0.0/12'],
      ['172.32.0.1', 'above 172.16.0.0/12'],
      ['172.100.5.5', 'well outside 172.16.0.0/12'],
      ['11.0.0.1', 'adjacent to 10.0.0.0/8'],
      ['192.169.0.1', 'adjacent to 192.168.0.0/16'],
      ['1.1.1.1', 'a public resolver'],
    ])('should allow public address %s (%s)', address => {
      expectAllowed(`http://${address}`, address)
    })

    it.each([
      ['[::]', 'IPv6 unspecified'],
      ['[fc00::1]', 'IPv6 unique local (fc00::/7)'],
      ['[fd12:3456:789a::1]', 'IPv6 unique local (fd00::/8)'],
      ['[fe80::1]', 'IPv6 link-local (fe80::/10)'],
      ['[febf::1]', 'top of IPv6 link-local'],
      ['[::ffff:127.0.0.1]', 'IPv4-mapped loopback'],
      ['[::ffff:169.254.169.254]', 'IPv4-mapped cloud metadata'],
      ['[::ffff:10.0.0.1]', 'IPv4-mapped private range'],
    ])('should block %s (%s)', address => {
      expectBlocked(`http://${address}`)
    })

    it.each([
      [
        '[2606:4700:4700::1111]',
        'a public IPv6 resolver',
        '[2606:4700:4700::1111]',
      ],
      // `URL` rewrites a mapped address to its dotted-quad form.
      ['[::ffff:1.1.1.1]', 'IPv4-mapped public address', '[::ffff:101:101]'],
      ['[fec0::1]', 'site-local, outside fe80::/10', '[fec0::1]'],
    ])(
      'should allow public IPv6 address %s (%s)',
      (address, _reason, hostname) => {
        expectAllowed(`http://${address}`, hostname)
      }
    )

    it.each([
      ['2130706433', 'decimal 127.0.0.1'],
      ['0x7f000001', 'hex 127.0.0.1'],
      ['0177.0.0.1', 'octal 127.0.0.1'],
      ['127.1', 'short-form 127.0.0.1'],
      ['0xa000001', 'hex 10.0.0.1'],
      ['0', 'decimal 0.0.0.0'],
      ['0300.0250.0.1', 'octal 192.168.0.1'],
    ])('should block %s (%s)', address => {
      expectBlocked(`http://${address}`)
    })

    it('should block .localhost domains', () => {
      // RFC 6761 reserves the whole TLD for loopback.
      expectBlocked('http://api.localhost')
    })

    it('should block .local domains', () => {
      expectBlocked('http://myserver.local')
      expectBlocked('https://printer.local')
      expectBlocked('http://device.home.local')
    })

    it.each([
      // Contain "local" but do not end in .local
      ['https://localhost-api.example.com', 'localhost-api.example.com'],
      ['http://localized.service.com', 'localized.service.com'],
      // Contain IP-like numbers but are not private IPs
      ['https://192168.example.com', '192168.example.com'],
      ['http://version10.service.com', 'version10.service.com'],
    ])('should allow %s, which only looks blocked', (url, hostname) => {
      expectAllowed(url, hostname)
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
