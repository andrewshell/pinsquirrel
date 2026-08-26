import { describe, it, expect } from 'vitest'
import {
  normalizeOAuthUri,
  protectedResourceMetadataPath,
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
