import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'

import { markdownNegotiation } from './markdown-negotiation'

describe('markdownNegotiation middleware', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.use('*', markdownNegotiation())
  })

  it('returns markdown when the request prefers it', async () => {
    app.get('/', (c) =>
      c.html(
        '<!doctype html><html><body><main><h1>Hi</h1><p>There</p></main></body></html>'
      )
    )

    const res = await app.request('/', {
      headers: { Accept: 'text/markdown' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('vary')).toBe('Accept')
    const body = await res.text()
    expect(body).toContain('# Hi')
    expect(body).toContain('There')
  })

  it('passes through HTML when the request does not prefer markdown', async () => {
    const html =
      '<!doctype html><html><body><main><h1>Hi</h1></main></body></html>'
    app.get('/', (c) => c.html(html))

    const res = await app.request('/', {
      headers: { Accept: 'text/html' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    const body = await res.text()
    expect(body).toContain('<h1>Hi</h1>')
  })

  it('passes through HTML when no Accept header is sent', async () => {
    app.get('/', (c) => c.html('<main><h1>Hi</h1></main>'))

    const res = await app.request('/')

    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
    const body = await res.text()
    expect(body).toContain('<h1>Hi</h1>')
  })

  it('passes through redirects unchanged even when markdown is preferred', async () => {
    app.get('/', (c) => c.redirect('/elsewhere'))

    const res = await app.request('/', {
      headers: { Accept: 'text/markdown' },
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/elsewhere')
    expect(res.headers.get('content-type')).not.toBe(
      'text/markdown; charset=utf-8'
    )
  })

  it('passes through non-HTML responses (JSON) unchanged', async () => {
    app.get('/', (c) => c.json({ ok: true }))

    const res = await app.request('/', {
      headers: { Accept: 'text/markdown' },
    })

    expect(res.headers.get('content-type')).toMatch(/json/)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
  })
})
