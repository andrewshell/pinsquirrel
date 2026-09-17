import { describe, expect, it } from 'vitest'
import { app } from './app'

/**
 * What an unmatched path answers with, against the real app so the middleware
 * order and the app-level handlers are the ones under test.
 *
 * The distinction is who is asking. A person who mistypes a URL wants the page;
 * an OAuth client probing for a discovery document wants JSON, and an HTML body
 * is not a cosmetic problem for it. A client works through the paths it might
 * find - `/.well-known/oauth-authorization-server/mcp` before the root form,
 * `openid-configuration` after - and parses each response. A 404 rendered as a
 * page ends the connection attempt with `Unexpected token '<'` instead of a
 * fallback to the document this server does serve, so the client never reaches
 * the working path. Claude tolerates it; a client built on the MCP SDK's auth
 * helpers does not.
 */

const DISCOVERY_PROBES = [
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server/mcp',
  '/.well-known/openid-configuration',
  '/.well-known/openid-configuration/mcp',
]

describe('unmatched paths a program asks for', () => {
  it.each(DISCOVERY_PROBES)('answers %s with JSON, not a page', async path => {
    const res = await app.request(path)

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ error: 'not_found' })
  })
})

describe('unmatched paths a person asks for', () => {
  it('still renders the not-found page', async () => {
    const res = await app.request('/no-such-page')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<!doctype html>')
  })
})
