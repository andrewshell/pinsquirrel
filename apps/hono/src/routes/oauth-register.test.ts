import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { OAuthClient } from '@pinsquirrel/domain'
import {
  OAuthInvalidClientMetadataError,
  ValidationError,
} from '@pinsquirrel/domain'

const mockRegisterClient = vi.fn()

vi.mock('../lib/services', () => ({
  oauthService: {
    registerClient: (...a: unknown[]) => mockRegisterClient(...a) as unknown,
  },
}))

import { oauthRegisterLimiter } from '../middleware/rate-limit'
import { TEST_CLIENT_IP, exhaust } from '../test-support/rate-limit'

const { oauthRegisterRoutes } = await import('./oauth-register')

const METADATA = {
  client_name: 'Claude Code',
  redirect_uris: ['http://localhost:54321/callback'],
}

const REGISTERED = {
  id: 'row-1',
  clientId: 'dcr_abc123',
  clientName: 'Claude Code',
  redirectUris: ['http://localhost:54321/callback'],
  grantTypes: ['authorization_code', 'refresh_token'],
  tokenEndpointAuthMethod: 'none',
  registrationType: 'dcr',
  metadataUrl: null,
  metadataFetchedAt: null,
  completedAt: null,
  createdAt: new Date('2026-08-25T12:00:00Z'),
} as unknown as OAuthClient

function json(body: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

describe('POST /oauth/register', () => {
  let app: Hono

  beforeEach(() => {
    vi.resetAllMocks()
    // The limiter is a module-level singleton, so each case starts with its
    // own budget rather than inheriting whatever the last one spent.
    oauthRegisterLimiter.reset(TEST_CLIENT_IP)
    app = new Hono()
    app.route('/oauth', oauthRegisterRoutes)
  })

  // The token endpoint is the form-encoded one. Sharing a parser between the
  // two is how one of them ends up accepting the wrong body shape.
  it('rejects a form-encoded body with 415', async () => {
    const res = await app.request('/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'client_name=Claude',
    })

    expect(res.status).toBe(415)
    expect(await res.json()).toEqual({
      error: 'invalid_client_metadata',
      error_description:
        'The registration endpoint accepts application/json only',
    })
    expect(mockRegisterClient).not.toHaveBeenCalled()
  })

  it('registers a client and answers 201 in the RFC 7591 shape', async () => {
    mockRegisterClient.mockResolvedValue(REGISTERED)

    const res = await app.request('/oauth/register', json(METADATA))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({
      client_id: 'dcr_abc123',
      client_id_issued_at: Math.floor(
        new Date('2026-08-25T12:00:00Z').getTime() / 1000
      ),
      client_name: 'Claude Code',
      redirect_uris: ['http://localhost:54321/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    })
    expect(mockRegisterClient).toHaveBeenCalledWith(METADATA)
  })

  it('omits client_name when the client did not send one', async () => {
    mockRegisterClient.mockResolvedValue({ ...REGISTERED, clientName: null })

    const res = await app.request('/oauth/register', json(METADATA))

    expect(await res.json()).not.toHaveProperty('client_name')
  })

  it('maps invalid metadata to invalid_client_metadata', async () => {
    mockRegisterClient.mockRejectedValue(
      new OAuthInvalidClientMetadataError(
        'This server registers public clients only'
      )
    )

    const res = await app.request('/oauth/register', json(METADATA))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_client_metadata',
      error_description: 'This server registers public clients only',
    })
  })

  // A schema failure on this endpoint is invalid_client_metadata, not the
  // invalid_request the token endpoint reports (RFC 7591 3.2.2).
  it('maps a ValidationError to invalid_client_metadata', async () => {
    mockRegisterClient.mockRejectedValue(
      new ValidationError({ redirect_uris: ['at least one is required'] })
    )

    const res = await app.request('/oauth/register', json({}))

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'invalid_client_metadata',
      error_description: 'redirect_uris: at least one is required',
    })
  })

  it('reports an unparseable body as invalid metadata rather than crashing', async () => {
    const res = await app.request('/oauth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_client_metadata')
    expect(mockRegisterClient).not.toHaveBeenCalled()
  })

  // The endpoint is unauthenticated and it creates rows, which is why this is
  // the tightest limit in the app.
  describe('rate limiting', () => {
    it('answers 429 with Retry-After once the per-IP quota is spent', async () => {
      exhaust(oauthRegisterLimiter, TEST_CLIENT_IP)

      const res = await app.request('/oauth/register', json(METADATA))

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeTruthy()
      expect(mockRegisterClient).not.toHaveBeenCalled()
    })
  })
})
