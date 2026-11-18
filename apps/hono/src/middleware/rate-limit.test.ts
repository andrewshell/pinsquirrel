import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { RateLimiter } from './rate-limiter'
import {
  apiV1Limiter,
  clientAddressKey,
  clientNetworkKey,
  getClientIp,
  mcpLimiter,
  rateLimitByIp,
  signinRateLimitKey,
} from './rate-limit'

function from(address: string) {
  return { incoming: { socket: { remoteAddress: address } } }
}

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

  describe('with TRUST_PROXY=1', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = '1'
    })

    it('returns last IP from x-forwarded-for (closest trusted proxy)', async () => {
      const res = await app.request(
        '/test',
        { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } },
        from('127.0.0.1')
      )
      expect(await res.text()).toBe('5.6.7.8')
    })

    it('falls back to x-real-ip from a trusted peer', async () => {
      const res = await app.request(
        '/test',
        { headers: { 'x-real-ip': '10.0.0.1' } },
        from('127.0.0.1')
      )
      expect(await res.text()).toBe('10.0.0.1')
    })

    it.each([
      '127.0.0.1',
      '::1',
      '10.1.2.3',
      '172.18.0.1',
      '192.168.1.10',
      '::ffff:172.17.0.1',
      'fd00::5',
    ])('trusts the headers from loopback or private peer %s', async peer => {
      const res = await app.request(
        '/test',
        { headers: { 'x-forwarded-for': '1.2.3.4' } },
        from(peer)
      )
      expect(await res.text()).toBe('1.2.3.4')
    })

    it.each(['203.0.113.9', '::ffff:203.0.113.9', '2001:db8::1', '172.32.0.1'])(
      'ignores the headers from public peer %s',
      async peer => {
        const res = await app.request(
          '/test',
          {
            headers: { 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '1.2.3.4' },
          },
          from(peer)
        )
        expect(await res.text()).toBe(peer)
      }
    )

    it('falls back to the socket peer address when no headers present', async () => {
      const res = await app.request('/test', undefined, from('10.9.9.9'))
      expect(await res.text()).toBe('10.9.9.9')
    })

    it('ignores the headers when the socket address is unavailable', async () => {
      const res = await app.request('/test', {
        headers: { 'x-forwarded-for': '1.2.3.4' },
      })
      expect(await res.text()).toBe('unknown')
    })
  })

  describe('with TRUST_PROXY naming the proxy', () => {
    beforeEach(() => {
      process.env.TRUST_PROXY = '10.0.0.2, 192.168.5.0/24'
    })

    it.each(['10.0.0.2', '192.168.5.77', '::ffff:10.0.0.2'])(
      'trusts the headers from listed peer %s',
      async peer => {
        const res = await app.request(
          '/test',
          { headers: { 'x-forwarded-for': '198.51.100.1' } },
          from(peer)
        )
        expect(await res.text()).toBe('198.51.100.1')
      }
    )

    it('skips an entry it cannot parse instead of failing the request', async () => {
      process.env.TRUST_PROXY = '10.0.0.2/33, 10.0.0.3'

      const res = await app.request(
        '/test',
        { headers: { 'x-forwarded-for': '198.51.100.1' } },
        from('10.0.0.3')
      )

      expect(res.status).toBe(200)
      expect(await res.text()).toBe('198.51.100.1')
    })

    it.each(['203.0.113.9', '10.0.0.3', '127.0.0.1'])(
      'ignores x-forwarded-for and x-real-ip from unlisted peer %s',
      async peer => {
        for (const header of ['x-forwarded-for', 'x-real-ip']) {
          const res = await app.request(
            '/test',
            { headers: { [header]: '198.51.100.1' } },
            from(peer)
          )
          expect(await res.text()).toBe(peer)
        }
      }
    )
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

  beforeEach(() => {
    limiter = new RateLimiter({ maxAttempts: 2, windowMs: 60_000 })
    app = new Hono()
    app.post('/test', rateLimitByIp(limiter, 'Rate limited.'), c =>
      c.text('ok')
    )
  })

  afterEach(() => {
    limiter.destroy()
  })

  it('passes requests through when under limit', async () => {
    const res = await app.request('/test', { method: 'POST' }, from('1.2.3.4'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('returns 429 with Retry-After when limit exceeded', async () => {
    await app.request('/test', { method: 'POST' }, from('1.2.3.4'))
    await app.request('/test', { method: 'POST' }, from('1.2.3.4'))

    const res = await app.request('/test', { method: 'POST' }, from('1.2.3.4'))
    expect(res.status).toBe(429)
    expect(await res.text()).toBe('Rate limited.')
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  /**
   * A refusal has to be readable by whoever is being refused. The OAuth and MCP
   * endpoints are spoken to by programs that parse every body as JSON, so a
   * text/plain 429 fails them the same way an HTML 404 does - and worse, mid
   * connection rather than during discovery. The browser routes behind this
   * limiter keep the plain text they always had.
   */
  it('refuses a program in JSON', async () => {
    const machine = new Hono()
    machine.post(
      '/oauth/register',
      rateLimitByIp(limiter, 'Rate limited.'),
      c => c.text('ok')
    )
    await machine.request(
      '/oauth/register',
      { method: 'POST' },
      from('1.2.3.4')
    )
    await machine.request(
      '/oauth/register',
      { method: 'POST' },
      from('1.2.3.4')
    )

    const res = await machine.request(
      '/oauth/register',
      { method: 'POST' },
      from('1.2.3.4')
    )

    expect(res.status).toBe(429)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({
      error: 'too_many_requests',
      error_description: 'Rate limited.',
    })
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('counts every address in one IPv6 /64 as one caller', async () => {
    await app.request('/test', { method: 'POST' }, from('2001:db8:1:2::1'))
    await app.request('/test', { method: 'POST' }, from('2001:db8:1:2:ffff::9'))

    const res = await app.request(
      '/test',
      { method: 'POST' },
      from('2001:0db8:0001:0002:abcd:1:2:3')
    )
    expect(res.status).toBe(429)
  })

  it('keeps different IPv6 /64s apart', async () => {
    await app.request('/test', { method: 'POST' }, from('2001:db8:1:2::1'))
    await app.request('/test', { method: 'POST' }, from('2001:db8:1:2::2'))

    const res = await app.request(
      '/test',
      { method: 'POST' },
      from('2001:db8:1:3::1')
    )
    expect(res.status).toBe(200)
  })

  it('counts an IPv4-mapped address as the IPv4 address', async () => {
    await app.request('/test', { method: 'POST' }, from('1.2.3.4'))
    await app.request('/test', { method: 'POST' }, from('::ffff:1.2.3.4'))

    const res = await app.request('/test', { method: 'POST' }, from('1.2.3.4'))
    expect(res.status).toBe(429)
  })

  it('allows different IPs independently', async () => {
    await app.request('/test', { method: 'POST' }, from('1.1.1.1'))
    await app.request('/test', { method: 'POST' }, from('1.1.1.1'))

    const res = await app.request('/test', { method: 'POST' }, from('2.2.2.2'))
    expect(res.status).toBe(200)
  })
})

describe('signinRateLimitKey', () => {
  it('builds key from IP and lowercase username', async () => {
    const app = new Hono()
    let key = ''
    app.get('/test', c => {
      key = signinRateLimitKey(c, 'UserName')
      return c.text('ok')
    })

    await app.request('/test', undefined, from('1.2.3.4'))

    expect(key).toBe('1.2.3.4:username')
  })

  it.each([
    ['1.2.3.4', '1.2.3.4'],
    ['::ffff:1.2.3.4', '1.2.3.4'],
    ['::ffff:102:304', '1.2.3.4'],
    ['::FFFF:0102:0304', '1.2.3.4'],
    ['::1', '::1'],
    ['::', '::'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
    ['2001:db8::ffff:102:304', '2001:db8:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['fe80::1%25eth0', 'fe80:0:0:0::/64'],
    ['2001:db8:1:2::%x', '2001:db8:1:2::/64'],
    ['::ffff:1.2.3.4%x', '1.2.3.4'],
    ['::1%lo', '::1'],
  ])('keys %s as %s', async (address, expected) => {
    const app = new Hono()
    let key = ''
    app.get('/test', c => {
      key = clientAddressKey(c)
      return c.text('ok')
    })

    await app.request('/test', undefined, from(address))

    expect(key).toBe(expected)
  })

  it('falls back to the raw address when canonicalisation fails', async () => {
    const RealURL = URL
    vi.stubGlobal(
      'URL',
      class extends RealURL {
        constructor(input: string | URL, base?: string | URL) {
          if (String(input).startsWith('http://[')) {
            throw new TypeError('Invalid URL')
          }
          super(input, base)
        }
      }
    )
    try {
      const app = new Hono()
      let key = ''
      app.get('/test', c => {
        key = clientAddressKey(c)
        return c.text('ok')
      })

      const res = await app.request('/test', undefined, from('2001:db8::1'))

      expect(res.status).toBe(200)
      expect(key).toBe('2001:db8::1')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([
    ['1.2.3.4', '1.2.3.4'],
    ['::ffff:1.2.3.4', '1.2.3.4'],
    ['::1', '::1'],
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1::/48'],
    ['2001:db8::1', '2001:db8:0::/48'],
  ])('keys the network around %s as %s', async (address, expected) => {
    const app = new Hono()
    let key = ''
    app.get('/test', c => {
      key = clientNetworkKey(c)
      return c.text('ok')
    })

    await app.request('/test', undefined, from(address))

    expect(key).toBe(expected)
  })

  it('keys an IPv6 caller on its /64', async () => {
    const app = new Hono()
    let key = ''
    app.get('/test', c => {
      key = signinRateLimitKey(c, 'alice')
      return c.text('ok')
    })

    await app.request('/test', undefined, from('2001:db8:1:2:3:4:5:6'))

    expect(key).toBe('2001:db8:1:2::/64:alice')
  })
})

describe('the two protected-resource budgets', () => {
  const key = 'budget-comparison'

  afterEach(() => {
    mcpLimiter.reset(key)
    apiV1Limiter.reset(key)
  })

  // Retagging is one update_pin per pin plus the reads around it, so an MCP
  // session is legitimately far chattier than a REST client working the same
  // collection. Keying /mcp by client instead is not on the table: the limiter
  // runs before auth, where there is no client to key on. Written as a
  // comparison rather than a number so retuning either budget does not have to
  // come here first.
  it('lets an MCP session outlast a REST client on the same address', () => {
    let spent = 0
    while (!apiV1Limiter.isLimited(key)) {
      apiV1Limiter.hit(key)
      spent++
    }

    for (let i = 0; i < spent; i++) mcpLimiter.hit(key)

    expect(mcpLimiter.isLimited(key)).toBe(false)
  })
})
