import { describe, it, expect } from 'vitest'
import { createOAuthConfig } from '../lib/config'
import { bearerChallenge } from './www-authenticate'

const config = createOAuthConfig('https://oauth.test:8443')

describe('bearerChallenge', () => {
  it('points at the resource own metadata document', () => {
    expect(bearerChallenge(config.resources.mcp)).toContain(
      'resource_metadata="https://oauth.test:8443/.well-known/oauth-protected-resource/mcp"'
    )
    expect(bearerChallenge(config.resources.apiV1)).toContain(
      'resource_metadata="https://oauth.test:8443/.well-known/oauth-protected-resource/api/v1"'
    )
  })

  it('names the Bearer scheme first, as the header grammar requires', () => {
    expect(bearerChallenge(config.resources.mcp).startsWith('Bearer ')).toBe(
      true
    )
  })

  it('advertises the scopes as a space-delimited list', () => {
    expect(bearerChallenge(config.resources.mcp)).toContain(
      'scope="pins:read tags:read pins:write tags:write"'
    )
  })

  it('separates parameters with a comma', () => {
    expect(bearerChallenge(config.resources.mcp)).toBe(
      'Bearer resource_metadata="https://oauth.test:8443/.well-known/oauth-protected-resource/mcp", scope="pins:read tags:read pins:write tags:write"'
    )
  })

  // RFC 6750 3.1: `scope` on an insufficient_scope challenge is the scope the
  // request actually needed, not the catalogue of everything on offer, so the
  // override replaces the advertised list rather than adding to it.
  it('names the error and only the missing scope when told to', () => {
    expect(
      bearerChallenge(config.resources.mcp, {
        error: 'insufficient_scope',
        scope: 'pins:write',
      })
    ).toBe(
      'Bearer error="insufficient_scope", resource_metadata="https://oauth.test:8443/.well-known/oauth-protected-resource/mcp", scope="pins:write"'
    )
  })

  // The two resources differ in one parameter and one only, so a client that
  // handles the challenge from one handles the other.
  it('phrases the REST resource challenge the same way', () => {
    expect(
      bearerChallenge(config.resources.apiV1, {
        error: 'insufficient_scope',
        scope: 'tags:write',
      })
    ).toBe(
      'Bearer error="insufficient_scope", resource_metadata="https://oauth.test:8443/.well-known/oauth-protected-resource/api/v1", scope="tags:write"'
    )
  })
})
