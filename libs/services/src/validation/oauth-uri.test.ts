import { describe, it, expect } from 'vitest'
import {
  canonicalizeRedirectUri,
  isLoopbackRedirectHost,
  matchRedirectUri,
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

describe('canonicalizeRedirectUri', () => {
  // RFC 8252 7.3: a native client listens on an ephemeral port it cannot know
  // at registration time, so the port is not part of its identity.
  it('drops the port for loopback hosts', () => {
    expect(canonicalizeRedirectUri('http://localhost:54321/callback')).toBe(
      'http://localhost/callback'
    )
    expect(canonicalizeRedirectUri('http://127.0.0.1:8912/callback')).toBe(
      'http://127.0.0.1/callback'
    )
    expect(canonicalizeRedirectUri('http://[::1]:8912/callback')).toBe(
      'http://[::1]/callback'
    )
  })

  it('keeps the port for every other host', () => {
    expect(canonicalizeRedirectUri('https://claude.ai:8443/cb')).toBe(
      'https://claude.ai:8443/cb'
    )
  })

  it('normalizes scheme, host case and trailing slash like any OAuth URI', () => {
    expect(canonicalizeRedirectUri('HTTPS://Claude.AI/api/mcp/cb/')).toBe(
      'https://claude.ai/api/mcp/cb'
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

  it('reads an unparseable URI as no match rather than throwing', () => {
    expect(redirectUriMatches('http://localhost/cb', '/cb')).toBe(false)
    expect(redirectUriMatches('not a uri', 'not a uri')).toBe(false)
  })
})

describe('matchRedirectUri', () => {
  // Claude Code's registered list, verbatim.
  const registered = ['http://localhost/callback', 'http://127.0.0.1/callback']

  it('returns the registered entry the request matched', () => {
    expect(
      matchRedirectUri(registered, 'http://localhost:54321/callback')
    ).toBe('http://localhost/callback')
    expect(matchRedirectUri(registered, 'http://127.0.0.1:1/callback')).toBe(
      'http://127.0.0.1/callback'
    )
  })

  it('returns null when nothing in the list matches', () => {
    expect(matchRedirectUri(registered, 'http://localhost:54321/evil')).toBe(
      null
    )
    expect(matchRedirectUri([], 'http://localhost/callback')).toBe(null)
  })
})
