import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverEndpoints } from './oauth-metadata.ts'
import { jsonResponse, stubFetch } from './test/fetch-mock.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const BASE_URL = 'https://pinsquirrel.com'

/** The two documents the real server publishes, as it publishes them. */
function stubDiscovery(issuer = BASE_URL) {
  return stubFetch({
    [`${BASE_URL}/.well-known/oauth-protected-resource/api/v1`]: jsonResponse({
      resource: `${BASE_URL}/api/v1`,
      authorization_servers: [issuer],
      scopes_supported: ['pins:read', 'tags:read'],
    }),
    [`${issuer}/.well-known/oauth-authorization-server`]: jsonResponse({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      code_challenge_methods_supported: ['S256'],
    }),
  })
}

describe('discoverEndpoints', () => {
  it('reads the api/v1 resource document and follows it to the authorization server', async () => {
    const fetched = stubDiscovery()

    const endpoints = await discoverEndpoints(BASE_URL)

    expect(endpoints).toEqual({
      resource: `${BASE_URL}/api/v1`,
      issuer: BASE_URL,
      authorizationEndpoint: `${BASE_URL}/oauth/authorize`,
      tokenEndpoint: `${BASE_URL}/oauth/token`,
      registrationEndpoint: `${BASE_URL}/oauth/register`,
      revocationEndpoint: `${BASE_URL}/oauth/revoke`,
    })
    expect(fetched.urls).toEqual([
      `${BASE_URL}/.well-known/oauth-protected-resource/api/v1`,
      `${BASE_URL}/.well-known/oauth-authorization-server`,
    ])
  })

  it('follows authorization_servers to an issuer that is not the base URL', async () => {
    const fetched = stubDiscovery('https://auth.example.test')

    const endpoints = await discoverEndpoints(BASE_URL)

    expect(endpoints.issuer).toBe('https://auth.example.test')
    expect(endpoints.tokenEndpoint).toBe(
      'https://auth.example.test/oauth/token'
    )
    expect(fetched.urls[1]).toBe(
      'https://auth.example.test/.well-known/oauth-authorization-server'
    )
  })

  it('accepts a base URL the user typed with a trailing slash', async () => {
    const fetched = stubDiscovery()

    await discoverEndpoints(`${BASE_URL}/`)

    expect(fetched.urls[0]).toBe(
      `${BASE_URL}/.well-known/oauth-protected-resource/api/v1`
    )
  })

  it('names the document and the status when discovery 404s', async () => {
    stubFetch({})

    await expect(discoverEndpoints(BASE_URL)).rejects.toThrow(
      /protected-resource metadata document .* answered 404/
    )
  })
})
