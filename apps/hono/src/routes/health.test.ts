import { describe, it, expect } from 'vitest'
import { app } from '../app.js'

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('returns ok status', async () => {
      const res = await app.request('/health')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.status).toBe('ok')
      expect(json.timestamp).toBeDefined()
    })
  })
})
