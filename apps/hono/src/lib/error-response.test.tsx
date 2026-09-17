import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { expectsJsonError, serverErrorResponse } from './error-response'

vi.mock('./logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
  safeError: (err: unknown) => err,
}))

describe('expectsJsonError', () => {
  it.each([
    '/.well-known/oauth-protected-resource/mcp',
    '/.well-known/oauth-authorization-server/mcp',
    '/.well-known/openid-configuration',
    '/mcp',
    '/mcp/',
    '/oauth/token',
    '/oauth/register',
    '/oauth/revoke',
    '/api/v1/pins',
  ])('%s is answered in JSON', path => {
    expect(expectsJsonError(path)).toBe(true)
  })

  it.each([
    '/',
    '/pins',
    '/no-such-page',
    // The consent screen is a page a person reads, not an endpoint.
    '/oauth/authorize',
    // Near misses, so the prefixes cannot widen by accident.
    '/mcpickle',
    '/apiary',
  ])('%s is answered in HTML', path => {
    expect(expectsJsonError(path)).toBe(false)
  })
})

describe('serverErrorResponse', () => {
  function appThatThrows(err: unknown) {
    const app = new Hono()
    app.get('/oauth/token', () => {
      throw err
    })
    app.get('/pins', () => {
      throw err
    })
    app.onError(serverErrorResponse)
    return app
  }

  it('hands a program JSON', async () => {
    const res = await appThatThrows(new Error('boom')).request('/oauth/token')

    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ error: 'server_error' })
  })

  it('hands a person the error page', async () => {
    const res = await appThatThrows(new Error('boom')).request('/pins')

    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('text/html')
  })

  it('does not leak the underlying error to a program', async () => {
    const res = await appThatThrows(
      new Error('connect ECONNREFUSED 10.0.0.1:3306')
    ).request('/oauth/token')

    expect(JSON.stringify(await res.json())).not.toContain('10.0.0.1')
  })

  /**
   * An HTTPException carries the response its thrower chose - the 401 from the
   * OAuth middleware, with its WWW-Authenticate header. Rewriting it here
   * would strip the discovery pointer a client needs.
   */
  it('passes an HTTPException through untouched', async () => {
    const thrown = new HTTPException(401, {
      res: new Response('{"error":"invalid_token"}', {
        status: 401,
        headers: {
          'content-type': 'application/json',
          'www-authenticate': 'Bearer resource_metadata="https://x.test/m"',
        },
      }),
    })

    const res = await appThatThrows(thrown).request('/oauth/token')

    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata')
  })
})
