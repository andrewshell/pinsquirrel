import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { RateLimiter } from './rate-limiter'
import { getClientIp, rateLimitByIp, signinRateLimitKey } from './rate-limit'

describe('getClientIp', () => {
  let app: Hono
  const originalTrustProxy = process.env.TRUST_PROXY

  beforeEach(() => {
    app = new Hono()
    app.get('/test', c => {
      return c.text(getClientIp(c))
    })
  })

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY
    } else {
      process.env.TRUST_PROXY = originalTrustProxy
    }
  })

  describe('with TRUST_PROXY set', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = '1'
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

    it('falls back to the socket peer address when no headers present', async () => {
      // Without a proxy header there is nothing to key a rate limit on, and the
      // old 'unknown' literal put every such caller in one shared bucket - so a
      // single attacker could 429 everyone else. The socket address is always
      // available under @hono/node-server, so this branch is what runs in
      // production whenever a request arrives without going through the proxy.
      const res = await app.request('/test', undefined, {
        incoming: { socket: { remoteAddress: '9.9.9.9' } },
      })
      expect(await res.text()).toBe('9.9.9.9')
    })

    it('returns unknown only when even the socket address is unavailable', async () => {
      const res = await app.request('/test')
      expect(await res.text()).toBe('unknown')
    })
  })

  describe('with TRUST_PROXY unset', () => {
    beforeEach(() => {
      delete process.env.TRUST_PROXY
    })

    it('ignores x-forwarded-for and uses the socket peer address', async () => {
      // Nothing sits in front of the app, so the caller writes the header
      // itself and could rotate it per request to get an unlimited budget.
      const res = await app.request(
        '/test',
        { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } },
        { incoming: { socket: { remoteAddress: '9.9.9.9' } } }
      )
      expect(await res.text()).toBe('9.9.9.9')
    })

    it('ignores x-real-ip and uses the socket peer address', async () => {
      const res = await app.request(
        '/test',
        { headers: { 'x-real-ip': '10.0.0.1' } },
        { incoming: { socket: { remoteAddress: '9.9.9.9' } } }
      )
      expect(await res.text()).toBe('9.9.9.9')
    })

    it('returns unknown when the socket address is unavailable', async () => {
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })
      expect(await res.text()).toBe('unknown')
    })
  })
})

describe('rateLimitByIp', () => {
  let limiter: RateLimiter
  let app: Hono
  const originalTrustProxy = process.env.TRUST_PROXY

  beforeEach(() => {
    // These cases distinguish callers by address, which only x-forwarded-for
    // can express under app.request(); trusting it is what production does.
    process.env.TRUST_PROXY = '1'
    limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    app = new Hono()
    app.post('/test', rateLimitByIp(limiter, 'Rate limited.'), c =>
      c.text('ok')
    )
  })

  afterEach(() => {
    limiter.destroy()
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY
    } else {
      process.env.TRUST_PROXY = originalTrustProxy
    }
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
  const originalTrustProxy = process.env.TRUST_PROXY

  beforeEach(() => {
    process.env.TRUST_PROXY = '1'
  })

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY
    } else {
      process.env.TRUST_PROXY = originalTrustProxy
    }
  })

  it('builds key from IP and lowercase username', async () => {
    const app = new Hono()
    let key = ''
    app.get('/test', c => {
      key = signinRateLimitKey(c, 'UserName')
      return c.text('ok')
    })

    await app.request('/test', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    })

    expect(key).toBe('1.2.3.4:username')
  })
})
