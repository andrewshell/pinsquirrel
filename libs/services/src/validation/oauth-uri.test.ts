import { describe, it, expect } from 'vitest'
import {
  redirectUriDedupKey,
  isLoopbackRedirectHost,
  normalizeOAuthUri,
  protectedResourceMetadataPath,
  redirectUriMatches,
} from './oauth-uri.js'

describe('normalizeOAuthUri', () => {
  it('lowercases the scheme and host', () => {
    expect(normalizeOAuthUri('HTTPS://PinSquirrel.COM/mcp')).toBe(
      'https://pinsquirrel.com/mcp'
    )
  })

  it('preserves path case, which is significant', () => {
    expect(normalizeOAuthUri('https://pinsquirrel.com/API/v1')).toBe(
      'https://pinsquirrel.com/API/v1'
    )
  })

  it('strips the default port for the scheme', () => {
    expect(normalizeOAuthUri('https://pinsquirrel.com:443/mcp')).toBe(
      'https://pinsquirrel.com/mcp'
    )
    expect(normalizeOAuthUri('http://localhost:80/mcp')).toBe(
      'http://localhost/mcp'
    )
  })

  it('keeps a non-default port', () => {
    expect(normalizeOAuthUri('http://localhost:8100/mcp')).toBe(
      'http://localhost:8100/mcp'
    )
  })

  it('strips a trailing slash', () => {
    expect(normalizeOAuthUri('https://pinsquirrel.com/api/v1/')).toBe(
      'https://pinsquirrel.com/api/v1'
    )
    expect(normalizeOAuthUri('https://pinsquirrel.com/')).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('drops a fragment, which a resource identifier may not carry', () => {
    expect(normalizeOAuthUri('https://pinsquirrel.com/mcp#frag')).toBe(
      'https://pinsquirrel.com/mcp'
    )
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeOAuthUri('  https://pinsquirrel.com/mcp  ')).toBe(
      'https://pinsquirrel.com/mcp'
    )
  })

  it('rejects a string that is not an absolute URI', () => {
    expect(() => normalizeOAuthUri('/mcp')).toThrow()
    expect(() => normalizeOAuthUri('')).toThrow()
  })
})

describe('protectedResourceMetadataPath', () => {
  it('inserts the well-known segment before the resource path (RFC 9728 3.1)', () => {
    expect(protectedResourceMetadataPath('https://pinsquirrel.com/mcp')).toBe(
      '/.well-known/oauth-protected-resource/mcp'
    )
    expect(
      protectedResourceMetadataPath('https://pinsquirrel.com/api/v1')
    ).toBe('/.well-known/oauth-protected-resource/api/v1')
  })

  it('returns the bare well-known path for a resource with no path', () => {
    expect(protectedResourceMetadataPath('https://pinsquirrel.com')).toBe(
      '/.well-known/oauth-protected-resource'
    )
    expect(protectedResourceMetadataPath('https://pinsquirrel.com/')).toBe(
      '/.well-known/oauth-protected-resource'
    )
  })

  it('normalizes before transforming', () => {
    expect(
      protectedResourceMetadataPath('HTTPS://PinSquirrel.COM:443/api/v1/')
    ).toBe('/.well-known/oauth-protected-resource/api/v1')
  })

  it('ignores host and port, which the path never carries', () => {
    expect(protectedResourceMetadataPath('http://localhost:8100/mcp')).toBe(
      '/.well-known/oauth-protected-resource/mcp'
    )
  })
})

describe('isLoopbackRedirectHost', () => {
  it('recognises the three loopback host forms RFC 8252 names', () => {
    expect(isLoopbackRedirectHost('localhost')).toBe(true)
    expect(isLoopbackRedirectHost('127.0.0.1')).toBe(true)
    expect(isLoopbackRedirectHost('[::1]')).toBe(true)
  })

  it('covers the whole 127.0.0.0/8 block, not just 127.0.0.1', () => {
    expect(isLoopbackRedirectHost('127.4.5.6')).toBe(true)
    expect(isLoopbackRedirectHost('127.255.255.255')).toBe(true)
  })

  it('rejects hosts that only look loopback', () => {
    expect(isLoopbackRedirectHost('claude.ai')).toBe(false)
    expect(isLoopbackRedirectHost('localhost.evil.com')).toBe(false)
    expect(isLoopbackRedirectHost('128.0.0.1')).toBe(false)
    expect(isLoopbackRedirectHost('[::2]')).toBe(false)
  })
})

describe('redirectUriDedupKey', () => {
  // RFC 8252 7.3: a native client listens on an ephemeral port it cannot know
  // at registration time, so the port is not part of its identity.
  it('drops the port for loopback hosts', () => {
    expect(redirectUriDedupKey('http://localhost:54321/callback')).toBe(
      'http://localhost/callback'
    )
    expect(redirectUriDedupKey('http://127.0.0.1:8912/callback')).toBe(
      'http://127.0.0.1/callback'
    )
    expect(redirectUriDedupKey('http://[::1]:8912/callback')).toBe(
      'http://[::1]/callback'
    )
  })

  it('keeps the port for every other host', () => {
    expect(redirectUriDedupKey('https://claude.ai:8443/cb')).toBe(
      'https://claude.ai:8443/cb'
    )
  })

  it('keeps everything else as sent, as authorize compares it', () => {
    expect(redirectUriDedupKey('https://Claude.AI:443/api/mcp/cb/')).toBe(
      'https://Claude.AI:443/api/mcp/cb/'
    )
    expect(redirectUriDedupKey('http://localhost:54321/callback/')).toBe(
      'http://localhost/callback/'
    )
  })
})

describe('redirectUriMatches', () => {
  // The real Claude Code shapes: it registers both portless loopback forms in
  // its CIMD document and then listens on whatever port it was given.
  it('matches a portless loopback registration against an ephemeral port', () => {
    expect(
      redirectUriMatches(
        'http://localhost/callback',
        'http://localhost:54321/callback'
      )
    ).toBe(true)
    expect(
      redirectUriMatches(
        'http://127.0.0.1/callback',
        'http://127.0.0.1:54321/callback'
      )
    ).toBe(true)
  })

  it('still distinguishes loopback hosts from each other', () => {
    expect(
      redirectUriMatches(
        'http://127.0.0.1/callback',
        'http://localhost:54321/callback'
      )
    ).toBe(false)
  })

  it('still requires the loopback path to match', () => {
    expect(
      redirectUriMatches(
        'http://localhost/callback',
        'http://localhost:54321/other'
      )
    ).toBe(false)
  })

  // Hosted Claude: a fixed HTTPS callback, exact match and nothing else.
  it('matches a hosted callback only exactly', () => {
    const registered = 'https://claude.ai/api/mcp/auth_callback'
    expect(
      redirectUriMatches(registered, 'https://claude.ai/api/mcp/auth_callback')
    ).toBe(true)
    expect(
      redirectUriMatches(registered, 'https://claude.ai/api/mcp/auth_callback2')
    ).toBe(false)
    expect(
      redirectUriMatches(
        registered,
        'https://claude.ai:8443/api/mcp/auth_callback'
      )
    ).toBe(false)
    expect(
      redirectUriMatches(registered, 'https://evil.ai/api/mcp/auth_callback')
    ).toBe(false)
  })

  // RFC 9700 4.1.3: simple string comparison.
  it.each([
    ['https://client.example/cb/', 'trailing slash'],
    ['https://u@client.example/cb', 'userinfo'],
    ['https://user:pw@client.example/cb', 'userinfo with password'],
    ['https://client.example/cb#f', 'fragment'],
    ['https://client.example/x/../cb', 'dot segments'],
    ['https://CLIENT.example/cb', 'host case'],
    ['https://client.example:443/cb', 'explicit default port'],
  ])('does not match %s (%s) against its registration', requested => {
    expect(redirectUriMatches('https://client.example/cb', requested)).toBe(
      false
    )
  })

  it('compares everything but the port on a loopback redirect', () => {
    const registered = 'http://127.0.0.1/callback'
    expect(
      redirectUriMatches(registered, 'http://127.0.0.1:53211/callback/')
    ).toBe(false)
    expect(
      redirectUriMatches(registered, 'http://u@127.0.0.1:53211/callback')
    ).toBe(false)
    expect(
      redirectUriMatches(registered, 'http://127.0.0.1:53211/callback#f')
    ).toBe(false)
    expect(
      redirectUriMatches(registered, 'http://127.0.0.1:53211/x/../callback')
    ).toBe(false)
  })

  it('lets a registered loopback port change too', () => {
    expect(
      redirectUriMatches(
        'http://localhost:8080/callback',
        'http://localhost:53211/callback'
      )
    ).toBe(true)
  })

  it('never matches an unparseable request', () => {
    expect(redirectUriMatches('http://localhost/cb', '/cb')).toBe(false)
  })

  it.each(['99999', '65536', '0', '00'])(
    'does not match a loopback request on port %s, which is no port',
    port => {
      expect(
        redirectUriMatches('http://127.0.0.1/cb', `http://127.0.0.1:${port}/cb`)
      ).toBe(false)
    }
  )

  it('matches a loopback request on either end of the port range', () => {
    expect(
      redirectUriMatches('http://127.0.0.1/cb', 'http://127.0.0.1:1/cb')
    ).toBe(true)
    expect(
      redirectUriMatches('http://127.0.0.1/cb', 'http://127.0.0.1:65535/cb')
    ).toBe(true)
  })
})
