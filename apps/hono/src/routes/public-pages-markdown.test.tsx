import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'

import { markdownNegotiation } from '../middleware/markdown-negotiation'
import { DefaultLayout } from '../views/layouts/default'
import { HomePage } from '../views/pages/home'
import { PrivacyPage } from '../views/pages/privacy'
import { TermsPage } from '../views/pages/terms'

describe('Public pages — markdown content negotiation', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.use('/', markdownNegotiation())
    app.use('/privacy', markdownNegotiation())
    app.use('/terms', markdownNegotiation())

    app.get('/', (c) =>
      c.html(
        <DefaultLayout title="Home" user={null}>
          <HomePage />
        </DefaultLayout>
      )
    )
    app.get('/privacy', (c) => c.html(<PrivacyPage user={null} />))
    app.get('/terms', (c) => c.html(<TermsPage user={null} />))
  })

  it('serves markdown for /privacy when requested', async () => {
    const res = await app.request('/privacy', {
      headers: { Accept: 'text/markdown' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(res.headers.get('vary')).toBe('Accept')

    const body = await res.text()
    expect(body).toContain('# Privacy Policy')
    expect(body).toContain('andrew@pinsquirrel.com')
    // Footer copyright line should be gone
    expect(body).not.toMatch(/©.*PinSquirrel/i)
    // Tailwind class names should not leak through
    expect(body).not.toContain('text-3xl')
    expect(body).not.toContain('class=')
  })

  it('serves markdown for /terms when requested', async () => {
    const res = await app.request('/terms', {
      headers: { Accept: 'text/markdown' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')

    const body = await res.text()
    expect(body).toContain('# Terms of Use')
    expect(body).toContain('## Acceptance of Terms')
  })

  it('serves markdown for / when requested', async () => {
    const res = await app.request('/', {
      headers: { Accept: 'text/markdown' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8')

    const body = await res.text()
    expect(body).toContain('# PinSquirrel')
    expect(body).toContain('## Hoard Everything')
    expect(body).toContain('## Find Your Shit')
    expect(body).toContain('## Your Secret Stash')
  })

  it('serves HTML for /privacy by default', async () => {
    const res = await app.request('/privacy', {
      headers: { Accept: 'text/html' },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)

    const body = await res.text()
    expect(body.toLowerCase()).toContain('<!doctype html>')
    expect(body).toContain('Privacy Policy')
  })

  it('serves HTML when Accept header is missing', async () => {
    const res = await app.request('/privacy')
    expect(res.headers.get('content-type')).toMatch(/^text\/html/)
  })
})
