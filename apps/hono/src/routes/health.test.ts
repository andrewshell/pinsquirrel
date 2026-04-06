import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

const mockExecute = vi.fn()

vi.mock('../lib/db', () => ({
  db: {
    execute: (...args: unknown[]): Promise<unknown> =>
      mockExecute(...args) as Promise<unknown>,
  },
}))

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  safeError: (e: unknown) => e,
}))

import { healthRoutes } from './health'

describe('Health Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.restoreAllMocks()
    app = new Hono()
    app.route('/health', healthRoutes)
  })

  describe('GET /health', () => {
    it('returns ok when database is connected', async () => {
      mockExecute.mockResolvedValue([[{ health_check: 1 }]])

      const res = await app.request('/health')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.status).toBe('ok')
      expect(json.database).toBe('connected')
      expect(json.uptime).toBeTypeOf('number')
      expect(json.timestamp).toBeDefined()
    })

    it('returns degraded when database is disconnected', async () => {
      mockExecute.mockRejectedValue(new Error('Connection refused'))

      const res = await app.request('/health')
      const json = await res.json()

      expect(res.status).toBe(503)
      expect(json.status).toBe('degraded')
      expect(json.database).toBe('disconnected')
      expect(json.error).toBe('database unavailable')
      expect(json.uptime).toBeTypeOf('number')
      expect(json.timestamp).toBeDefined()
    })
  })
})
