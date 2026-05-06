import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'

import { seoRoutes } from './seo'

describe('SEO Routes', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', seoRoutes)
  })

  describe('GET /robots.txt', () => {
    it('returns 200 with text/plain content type', async () => {
      const res = await app.request('http://example.com/robots.txt')

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/^text\/plain/)
    })

    it('includes a wildcard User-agent directive', async () => {
      const res = await app.request('http://example.com/robots.txt')
      const body = await res.text()

      expect(body).toMatch(/^User-agent:\s*\*/m)
    })

    it('disallows authenticated user paths', async () => {
      const res = await app.request('http://example.com/robots.txt')
      const body = await res.text()

      for (const path of [
        '/pins',
        '/tags',
        '/profile',
        '/import',
        '/export',
        '/private',
        '/api/',
        '/mcp',
        '/reset-password/',
      ]) {
        expect(body).toContain(`Disallow: ${path}`)
      }
    })

    it('references the sitemap with an absolute URL derived from the request', async () => {
      const res = await app.request('http://example.com/robots.txt')
      const body = await res.text()

      expect(body).toContain('Sitemap: http://example.com/sitemap.xml')
    })

    it('uses the request host so it works on any deployment domain', async () => {
      const res = await app.request('https://app.pinsquirrel.com/robots.txt')
      const body = await res.text()

      expect(body).toContain('Sitemap: https://app.pinsquirrel.com/sitemap.xml')
    })

    it('declares Content-Signal preferences under the wildcard block', async () => {
      const res = await app.request('http://example.com/robots.txt')
      const body = await res.text()

      expect(body).toMatch(
        /^Content-Signal:\s*search=yes,\s*ai-train=yes,\s*ai-input=yes\s*$/m
      )
    })

    it('emits Content-Signal exactly once', async () => {
      const res = await app.request('http://example.com/robots.txt')
      const body = await res.text()

      const matches = body.match(/^Content-Signal:/gm) ?? []
      expect(matches).toHaveLength(1)
    })

    it('declares only the wildcard User-agent block', async () => {
      const res = await app.request('http://example.com/robots.txt')
      const body = await res.text()

      const matches = body.match(/^User-agent:/gm) ?? []
      expect(matches).toHaveLength(1)
      expect(body).toMatch(/^User-agent:\s*\*\s*$/m)
    })
  })

  describe('GET /sitemap.xml', () => {
    it('returns 200 with an XML content type', async () => {
      const res = await app.request('http://example.com/sitemap.xml')

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/xml/)
    })

    it('declares the sitemap XML namespace', async () => {
      const res = await app.request('http://example.com/sitemap.xml')
      const body = await res.text()

      expect(body).toContain(
        'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
      )
    })

    it('lists canonical public URLs using the request host', async () => {
      const res = await app.request('https://app.pinsquirrel.com/sitemap.xml')
      const body = await res.text()

      expect(body).toContain('<loc>https://app.pinsquirrel.com/</loc>')
      expect(body).toContain('<loc>https://app.pinsquirrel.com/privacy</loc>')
      expect(body).toContain('<loc>https://app.pinsquirrel.com/terms</loc>')
    })

    it('does not list authenticated or token-bound paths', async () => {
      const res = await app.request('https://app.pinsquirrel.com/sitemap.xml')
      const body = await res.text()

      for (const path of [
        '/pins',
        '/tags',
        '/profile',
        '/import',
        '/export',
        '/private',
        '/api/',
        '/reset-password',
        '/signout',
      ]) {
        expect(body).not.toContain(`<loc>https://app.pinsquirrel.com${path}`)
      }
    })
  })
})
