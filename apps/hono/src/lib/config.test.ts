import { describe, it, expect } from 'vitest'
import {
  createOAuthConfig,
  resolveBaseUrl,
  resolveStaticOAuthClients,
} from './config'

describe('resolveBaseUrl', () => {
  it('uses BASE_URL when it is set', () => {
    expect(resolveBaseUrl({ BASE_URL: 'https://pinsquirrel.com' })).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('normalizes the configured value', () => {
    expect(resolveBaseUrl({ BASE_URL: 'HTTPS://PinSquirrel.com:443/' })).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('defaults to the dev server outside production', () => {
    expect(resolveBaseUrl({})).toBe('http://localhost:8100')
    expect(resolveBaseUrl({ NODE_ENV: 'development' })).toBe(
      'http://localhost:8100'
    )
  })

  it('fails when BASE_URL is unset in production', () => {
    expect(() => resolveBaseUrl({ NODE_ENV: 'production' })).toThrow(/BASE_URL/)
  })

  it('fails when BASE_URL is blank in production', () => {
    expect(() =>
      resolveBaseUrl({ NODE_ENV: 'production', BASE_URL: '   ' })
    ).toThrow(/BASE_URL/)
  })

  it('fails when BASE_URL is not an absolute URI', () => {
    expect(() => resolveBaseUrl({ BASE_URL: 'pinsquirrel.com' })).toThrow()
  })
})

describe('createOAuthConfig', () => {
  it('derives the issuer from the base URL', () => {
    expect(createOAuthConfig('https://pinsquirrel.com').issuer).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('derives both protected resources and their metadata locations', () => {
    const config = createOAuthConfig('https://pinsquirrel.com')

    expect(config.resources.mcp).toMatchObject({
      resource: 'https://pinsquirrel.com/mcp',
      metadataPath: '/.well-known/oauth-protected-resource/mcp',
      metadataUrl:
        'https://pinsquirrel.com/.well-known/oauth-protected-resource/mcp',
    })
    expect(config.resources.apiV1).toMatchObject({
      resource: 'https://pinsquirrel.com/api/v1',
      metadataPath: '/.well-known/oauth-protected-resource/api/v1',
      metadataUrl:
        'https://pinsquirrel.com/.well-known/oauth-protected-resource/api/v1',
    })
  })

  it('keeps the two resource identifiers distinct, so a token for one is not a token for the other', () => {
    const config = createOAuthConfig('https://pinsquirrel.com')
    expect(config.resources.mcp.resource).not.toBe(
      config.resources.apiV1.resource
    )
  })

  it('follows a non-production base URL, port included', () => {
    const config = createOAuthConfig('http://localhost:8100')

    expect(config.issuer).toBe('http://localhost:8100')
    expect(config.resources.mcp.metadataUrl).toBe(
      'http://localhost:8100/.well-known/oauth-protected-resource/mcp'
    )
    expect(config.resources.apiV1.resource).toBe('http://localhost:8100/api/v1')
  })

  // A scope a resource never advertises is one no client knows to ask for,
  // so the writes have to appear here as well as in the challenge.
  it('advertises the read and write scopes on each resource, without offline_access', () => {
    const config = createOAuthConfig('https://pinsquirrel.com')

    const expected = ['pins:read', 'tags:read', 'pins:write', 'tags:write']
    expect(config.resources.mcp.scopes).toEqual(expected)
    expect(config.resources.apiV1.scopes).toEqual(expected)
    expect(config.resources.mcp.scopes).not.toContain('offline_access')
    expect(config.resources.apiV1.scopes).not.toContain('offline_access')
  })
})

describe('resolveStaticOAuthClients', () => {
  it('is empty when the variable is unset or blank', () => {
    expect(resolveStaticOAuthClients({})).toEqual([])
    expect(resolveStaticOAuthClients({ OAUTH_STATIC_CLIENTS: '   ' })).toEqual(
      []
    )
  })

  it('reads the clients an operator pre-registered', () => {
    const clients = resolveStaticOAuthClients({
      OAUTH_STATIC_CLIENTS: JSON.stringify([
        {
          client_id: 'acme-connector',
          client_name: 'Acme Connector',
          redirect_uris: ['https://acme.example.com/callback'],
        },
      ]),
    })

    expect(clients).toEqual([
      {
        clientId: 'acme-connector',
        clientName: 'Acme Connector',
        redirectUris: ['https://acme.example.com/callback'],
      },
    ])
  })

  it('fails at boot on a value that is not JSON', () => {
    expect(() =>
      resolveStaticOAuthClients({ OAUTH_STATIC_CLIENTS: 'acme-connector' })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })

  it('fails at boot on a JSON value that is not an array of clients', () => {
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify({ client_id: 'acme' }),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })

  it('fails at boot on a client with no redirect URIs', () => {
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([
          { client_id: 'acme', client_name: 'Acme', redirect_uris: [] },
        ]),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })

  it('fails at boot on a redirect URI this server would never redirect to', () => {
    // Same rule the registration path applies: https, or http on loopback.
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([
          {
            client_id: 'acme',
            client_name: 'Acme',
            redirect_uris: ['http://acme.example.com/callback'],
          },
        ]),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })

  it('fails at boot on a client_id that looks like a CIMD document URL', () => {
    // An http(s) client_id is resolved by fetching it, so a static row under
    // that identifier would never be looked up in the table.
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([
          {
            client_id: 'https://acme.example.com/client',
            client_name: 'Acme',
            redirect_uris: ['https://acme.example.com/callback'],
          },
        ]),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })

  it('fails at boot when two clients share a client_id', () => {
    const entry = {
      client_id: 'acme',
      client_name: 'Acme',
      redirect_uris: ['https://acme.example.com/callback'],
    }
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([entry, entry]),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })
})
