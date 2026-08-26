import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { createOAuthConfig } from '../lib/config'
import { createOAuthMetadataRoutes } from './oauth-metadata'

// A base URL that is neither the production host nor the dev default, so a
// hardcoded value anywhere in the documents shows up as a failure.
const BASE_URL = 'https://oauth.test:8443'

function buildApp(baseUrl = BASE_URL) {
  const app = new Hono()
  app.route('/', createOAuthMetadataRoutes(createOAuthConfig(baseUrl)))
  return app
}

async function fetchJson(path: string, baseUrl = BASE_URL) {
  const res = await buildApp(baseUrl).request(path)
  return { res, body: (await res.json()) as Record<string, unknown> }
}

describe('GET /.well-known/oauth-protected-resource/mcp', () => {
  it('serves the MCP resource document as JSON', async () => {
    const { res, body } = await fetchJson(
      '/.well-known/oauth-protected-resource/mcp'
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(body.resource).toBe('https://oauth.test:8443/mcp')
    expect(body.authorization_servers).toEqual(['https://oauth.test:8443'])
    expect(body.scopes_supported).toEqual(['pins:read', 'tags:read'])
  })

  it('does not advertise offline_access, which is not a resource requirement', async () => {
    const { body } = await fetchJson(
      '/.well-known/oauth-protected-resource/mcp'
    )
    expect(body.scopes_supported).not.toContain('offline_access')
  })
})

describe('GET /.well-known/oauth-protected-resource/api/v1', () => {
  it('serves the REST resource document with its own identifier', async () => {
    const { res, body } = await fetchJson(
      '/.well-known/oauth-protected-resource/api/v1'
    )

    expect(res.status).toBe(200)
    expect(body.resource).toBe('https://oauth.test:8443/api/v1')
    expect(body.authorization_servers).toEqual(['https://oauth.test:8443'])
    expect(body.scopes_supported).toEqual(['pins:read', 'tags:read'])
    expect(body.scopes_supported).not.toContain('offline_access')
  })
})

describe('GET /.well-known/oauth-authorization-server', () => {
  it('serves the RFC 8414 document with every field a client selects on', async () => {
    const { res, body } = await fetchJson(
      '/.well-known/oauth-authorization-server'
    )

    expect(res.status).toBe(200)
    expect(body).toEqual({
      issuer: 'https://oauth.test:8443',
      authorization_endpoint: 'https://oauth.test:8443/oauth/authorize',
      token_endpoint: 'https://oauth.test:8443/oauth/token',
      registration_endpoint: 'https://oauth.test:8443/oauth/register',
      revocation_endpoint: 'https://oauth.test:8443/oauth/revoke',
      scopes_supported: ['pins:read', 'tags:read', 'offline_access'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      client_id_metadata_document_supported: true,
      token_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: true,
    })
  })

  it('advertises offline_access, without which Claude never asks for a refresh token', async () => {
    const { body } = await fetchJson('/.well-known/oauth-authorization-server')
    expect(body.scopes_supported).toContain('offline_access')
  })
})

describe('base URL', () => {
  it('reflects the configured base URL rather than a hardcoded production host', async () => {
    const local = 'http://localhost:8100'
    const { body: mcp } = await fetchJson(
      '/.well-known/oauth-protected-resource/mcp',
      local
    )
    const { body: as } = await fetchJson(
      '/.well-known/oauth-authorization-server',
      local
    )

    expect(mcp.resource).toBe('http://localhost:8100/mcp')
    expect(mcp.authorization_servers).toEqual(['http://localhost:8100'])
    expect(as.issuer).toBe('http://localhost:8100')
    expect(as.token_endpoint).toBe('http://localhost:8100/oauth/token')
  })

  it('serves each resource document at the path its resource identifier implies', async () => {
    const config = createOAuthConfig(BASE_URL)
    const app = buildApp()

    for (const resource of [config.resources.mcp, config.resources.apiV1]) {
      const res = await app.request(resource.metadataPath)
      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.resource).toBe(resource.resource)
    }
  })
})
