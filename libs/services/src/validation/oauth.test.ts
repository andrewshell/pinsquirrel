import { describe, it, expect } from 'vitest'
import {
  authorizationRequestSchema,
  authorizationCodeGrantSchema,
  clientIdMetadataDocumentSchema,
  clientRegistrationSchema,
  refreshTokenGrantSchema,
  tokenRequestSchema,
} from './oauth.js'

/** A copy of `params` with one field removed, to test that it is required. */
function without<T extends object>(params: T, key: keyof T): Partial<T> {
  const copy = { ...params }
  delete copy[key]
  return copy
}

// A real Claude authorization request, minus the values that vary.
const authorizeParams = {
  response_type: 'code',
  client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
  redirect_uri: 'http://localhost:54321/callback',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  scope: 'pins:read tags:read offline_access',
  state: 'opaque-state',
  resource: 'https://pinsquirrel.com/mcp',
}

describe('authorizationRequestSchema', () => {
  it('accepts an authorization request as it arrives on the wire', () => {
    const result = authorizationRequestSchema.safeParse(authorizeParams)
    expect(result.success).toBe(true)
  })

  it('accepts a request with no scope or state, both optional', () => {
    const rest = without(without(authorizeParams, 'scope'), 'state')
    expect(authorizationRequestSchema.safeParse(rest).success).toBe(true)
  })

  // OAuth 2.1 requires PKCE, and S256 is the only method the metadata
  // advertises. `plain` and a missing method both mean "not S256".
  it('rejects the plain PKCE method', () => {
    expect(
      authorizationRequestSchema.safeParse({
        ...authorizeParams,
        code_challenge_method: 'plain',
      }).success
    ).toBe(false)
  })

  it('rejects a request with no code challenge at all', () => {
    const rest = without(authorizeParams, 'code_challenge')
    expect(authorizationRequestSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a code challenge that is not a PKCE value', () => {
    expect(
      authorizationRequestSchema.safeParse({
        ...authorizeParams,
        code_challenge: 'too-short',
      }).success
    ).toBe(false)
  })

  it('rejects a response type other than code', () => {
    expect(
      authorizationRequestSchema.safeParse({
        ...authorizeParams,
        response_type: 'token',
      }).success
    ).toBe(false)
  })

  // Audience binding is mandatory (Decision 17), so the request has to name
  // the resource it wants a token for. There is no safe default with two
  // protected resources.
  it('rejects a request with no resource', () => {
    const rest = without(authorizeParams, 'resource')
    expect(authorizationRequestSchema.safeParse(rest).success).toBe(false)
  })
})

describe('token grant schemas', () => {
  const codeGrant = {
    grant_type: 'authorization_code',
    code: 'raw-code',
    redirect_uri: 'http://localhost:54321/callback',
    client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
    code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  }

  const refreshGrant = {
    grant_type: 'refresh_token',
    refresh_token: 'raw-refresh',
    client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
  }

  it('accepts an authorization code exchange', () => {
    expect(authorizationCodeGrantSchema.safeParse(codeGrant).success).toBe(true)
    expect(tokenRequestSchema.safeParse(codeGrant).success).toBe(true)
  })

  it('requires the PKCE verifier on a code exchange', () => {
    const rest = without(codeGrant, 'code_verifier')
    expect(authorizationCodeGrantSchema.safeParse(rest).success).toBe(false)
  })

  it('accepts a refresh exchange', () => {
    expect(refreshTokenGrantSchema.safeParse(refreshGrant).success).toBe(true)
    expect(tokenRequestSchema.safeParse(refreshGrant).success).toBe(true)
  })

  it('accepts an optional resource on either grant', () => {
    expect(
      tokenRequestSchema.safeParse({
        ...refreshGrant,
        resource: 'https://pinsquirrel.com/mcp',
      }).success
    ).toBe(true)
  })

  it('rejects a grant type this server does not implement', () => {
    expect(
      tokenRequestSchema.safeParse({
        grant_type: 'client_credentials',
        client_id: 'x',
      }).success
    ).toBe(false)
  })
})

describe('clientRegistrationSchema', () => {
  it('accepts an RFC 7591 registration body', () => {
    const result = clientRegistrationSchema.safeParse({
      client_name: 'Some MCP Client',
      redirect_uris: ['https://example.com/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
    })
    expect(result.success).toBe(true)
  })

  it('requires at least one redirect URI, since there is nowhere to send the user without one', () => {
    expect(
      clientRegistrationSchema.safeParse({ redirect_uris: [] }).success
    ).toBe(false)
  })

  it('rejects a script-scheme redirect URI', () => {
    expect(
      clientRegistrationSchema.safeParse({
        redirect_uris: ['javascript:alert(1)'],
      }).success
    ).toBe(false)
  })
})

describe('clientIdMetadataDocumentSchema', () => {
  // Claude Code's published document, trimmed to the fields that matter.
  const document = {
    client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
    client_name: 'Claude Code',
    redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }

  it('accepts a CIMD document', () => {
    const result = clientIdMetadataDocumentSchema.safeParse(document)
    expect(result.success).toBe(true)
    expect(result.data?.client_id).toBe(document.client_id)
  })

  // Without a `client_id` there is nothing to compare against the URL the
  // document was fetched from, which is the whole check CIMD rests on.
  it('requires the client_id the document is named by', () => {
    const rest = without(document, 'client_id')
    expect(clientIdMetadataDocumentSchema.safeParse(rest).success).toBe(false)
  })

  it('requires at least one redirect URI', () => {
    expect(
      clientIdMetadataDocumentSchema.safeParse({
        ...document,
        redirect_uris: [],
      }).success
    ).toBe(false)
  })
})
