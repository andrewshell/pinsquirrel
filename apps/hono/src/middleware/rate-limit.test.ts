import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { RateLimiter } from './rate-limiter'
import { getClientIp, rateLimitByIp, signinRateLimitKey } from './rate-limit'

describe('getClientIp', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.get('/test', (c) => {
      return c.text(getClientIp(c))
    })
  })

  it('returns last IP from x-forwarded-for (closest trusted proxy)', async () => {
    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(await res.text()).toBe('5.6.7.8')
  })

  it('handles single IP in x-forwarded-for', async () => {
    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    expect(await res.text()).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', async () => {
    const res = await app.request('/test', {
      headers: { 'x-real-ip': '10.0.0.1' },
    })
    expect(await res.text()).toBe('10.0.0.1')
  })

  it('returns unknown when no headers present', async () => {
    const res = await app.request('/test')
    expect(await res.text()).toBe('unknown')
  })
})

describe('rateLimitByIp', () => {
  let limiter: RateLimiter
  let app: Hono

  beforeEach(() => {
    limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    app = new Hono()
    app.post('/test', rateLimitByIp(limiter, 'Rate limited.'), (c) =>
      c.text('ok')
    )
  })

  afterEach(() => {
    limiter.destroy()
  })

  it('passes requests through when under limit', async () => {
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('returns 429 with Retry-After when limit exceeded', async () => {
    const headers = { 'x-forwarded-for': '1.2.3.4' }
    await app.request('/test', { method: 'POST', headers })
    await app.request('/test', { method: 'POST', headers })

    const res = await app.request('/test', { method: 'POST', headers })
    expect(res.status).toBe(429)
    expect(await res.text()).toBe('Rate limited.')
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('allows different IPs independently', async () => {
    await app.request('/test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.1.1.1' },
    })
    await app.request('/test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '1.1.1.1' },
    })

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'x-forwarded-for': '2.2.2.2' },
    })
    expect(res.status).toBe(200)
  })
})

describe('signinRateLimitKey', () => {
  it('builds key from IP and lowercase username', async () => {
    const app = new Hono()
    let key = ''
    app.get('/test', (c) => {
      key = signinRateLimitKey(c, 'UserName')
      return c.text('ok')
    })

    await app.request('/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    expect(key).toBe('1.2.3.4:username')
  })
})
