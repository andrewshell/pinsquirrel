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

  it.each([
    ['a path', 'https://pinsquirrel.com/app'],
    ['a query', 'https://pinsquirrel.com/?x=1'],
    ['a fragment', 'https://pinsquirrel.com/#top'],
    ['userinfo', 'https://admin@pinsquirrel.com'],
  ])(
    'fails when BASE_URL carries %s, since discovery is served at the origin',
    (_, value) => {
      expect(() => resolveBaseUrl({ BASE_URL: value })).toThrow(/BASE_URL/)
    }
  )

  it('fails when BASE_URL is plain http in production', () => {
    expect(() =>
      resolveBaseUrl({
        NODE_ENV: 'production',
        BASE_URL: 'http://pinsquirrel.com',
      })
    ).toThrow(/BASE_URL/)
  })

  it('accepts plain http on loopback in production, for a local container', () => {
    expect(
      resolveBaseUrl({
        NODE_ENV: 'production',
        BASE_URL: 'http://localhost:8100',
      })
    ).toBe('http://localhost:8100')
  })

  it('accepts plain http outside production, for a tunnel or a LAN host', () => {
    expect(resolveBaseUrl({ BASE_URL: 'http://192.168.1.20:8100' })).toBe(
      'http://192.168.1.20:8100'
    )
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

  it('fails at boot on a redirect URI with a fragment', () => {
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([
          {
            client_id: 'acme',
            client_name: 'Acme',
            redirect_uris: ['https://acme.example.com/callback#x'],
          },
        ]),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS/)
  })

  it.each([
    'https://u:p@acme.example.com/callback',
    'https://u@acme.example.com/callback',
    'http://@127.0.0.1/callback',
  ])('fails at boot on a redirect URI with userinfo: %s', uri => {
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([
          { client_id: 'acme', client_name: 'Acme', redirect_uris: [uri] },
        ]),
      })
    ).toThrow(/OAUTH_STATIC_CLIENTS is invalid.*no fragment or userinfo/)
  })

  it.each([
    ['client_id', { client_id: 'a'.repeat(256) }],
    ['client_name', { client_name: 'a'.repeat(256) }],
    [
      'redirect URI',
      { redirect_uris: [`https://acme.example.com/${'a'.repeat(500)}`] },
    ],
  ])('fails at boot on a %s longer than its column', (_, patch) => {
    expect(() =>
      resolveStaticOAuthClients({
        OAUTH_STATIC_CLIENTS: JSON.stringify([
          {
            client_id: 'acme',
            client_name: 'Acme',
            redirect_uris: ['https://acme.example.com/callback'],
            ...patch,
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
