import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { securityHeaders } from './security-headers'

/**
 * The CSP is only worth anything if no page needs an exception to it: one
 * inline `<script>` anywhere in the app and every page has to relax
 * `script-src`. These assertions are the reminder.
 */
describe('securityHeaders', () => {
  const app = new Hono()
  app.use('*', securityHeaders())
  app.get('/', c => c.html('<!doctype html><html><body>hi</body></html>'))

  it('sends a Content-Security-Policy on a full page', async () => {
    const res = await app.request('/')

    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).not.toBeNull()
    expect(csp).toContain("script-src 'self'")
  })

  it('keeps the rest of the secure-headers defaults', async () => {
    const res = await app.request('/')

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})
