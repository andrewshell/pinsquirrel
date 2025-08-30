import { describe, it, expect } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  hashEmail,
  generateSecureToken,
  hashToken,
} from './crypto.js'

describe('crypto utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'mySecurePassword123'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should produce different hashes for the same password', async () => {
      const password = 'mySecurePassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty password', async () => {
      const password = ''
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'mySecurePassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'mySecurePassword123'
      const wrongPassword = 'wrongPassword'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(wrongPassword, hash)
      expect(isValid).toBe(false)
    })

    it('should handle empty password verification', async () => {
      const password = 'mySecurePassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('', hash)
      expect(isValid).toBe(false)
    })

    it('should be timing-safe', async () => {
      const password = 'mySecurePassword123'
      const hash = await hashPassword(password)
      const wrongPassword = 'wrongPassword'

      const startTime1 = process.hrtime.bigint()
      await verifyPassword(wrongPassword, hash)
      const endTime1 = process.hrtime.bigint()

      const startTime2 = process.hrtime.bigint()
      await verifyPassword(password, hash)
      const endTime2 = process.hrtime.bigint()

      // Both operations should take roughly the same time
      const diff1 = Number(endTime1 - startTime1)
      const diff2 = Number(endTime2 - startTime2)
      const ratio = Math.max(diff1, diff2) / Math.min(diff1, diff2)

      // Allow for some variance but they should be close
      expect(ratio).toBeLessThan(5)
    })

    it('should return false for invalid hash format', async () => {
      const password = 'mySecurePassword123'
      const invalidHash = 'invalid-hash-format'

      const isValid = await verifyPassword(password, invalidHash)
      expect(isValid).toBe(false)
    })

    it('should return false for hash missing colon separator', async () => {
      const password = 'mySecurePassword123'
      const invalidHash = 'no-colon-separator'

      const isValid = await verifyPassword(password, invalidHash)
      expect(isValid).toBe(false)
    })

    it('should return false for hash with invalid base64', async () => {
      const password = 'mySecurePassword123'
      const invalidHash = 'invalid@base64:also@invalid'

      const isValid = await verifyPassword(password, invalidHash)
      expect(isValid).toBe(false)
    })
  })

  describe('hashEmail', () => {
    it('should hash an email address', () => {
      const email = 'user@example.com'
      const hash = hashEmail(email)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(email)
      expect(hash.length).toBe(64) // SHA-256 produces 64 character hex string
    })

    it('should produce same hash for same email', () => {
      const email = 'user@example.com'
      const hash1 = hashEmail(email)
      const hash2 = hashEmail(email)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different emails', () => {
      const email1 = 'user1@example.com'
      const email2 = 'user2@example.com'
      const hash1 = hashEmail(email1)
      const hash2 = hashEmail(email2)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty email', () => {
      const email = ''
      const hash = hashEmail(email)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(64)
    })

    it('should be case-insensitive', () => {
      const email1 = 'User@Example.COM'
      const email2 = 'user@example.com'
      const hash1 = hashEmail(email1)
      const hash2 = hashEmail(email2)

      expect(hash1).toBe(hash2)
    })
  })

  describe('generateSecureToken', () => {
    it('should generate a token', () => {
      const token = generateSecureToken()

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should generate URL-safe tokens', () => {
      const token = generateSecureToken()

      // URL-safe base64 only contains alphanumeric, -, and _
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      // Should not contain URL-unsafe characters
      expect(token).not.toContain('+')
      expect(token).not.toContain('/')
      expect(token).not.toContain('=')
    })

    it('should generate unique tokens', () => {
      const tokens = new Set()
      const numTokens = 100

      for (let i = 0; i < numTokens; i++) {
        tokens.add(generateSecureToken())
      }

      // All tokens should be unique
      expect(tokens.size).toBe(numTokens)
    })

    it('should generate tokens of consistent length', () => {
      const token1 = generateSecureToken()
      const token2 = generateSecureToken()

      // 32 bytes in base64url encoding should be ~43 characters
      expect(token1.length).toBeGreaterThanOrEqual(42)
      expect(token1.length).toBeLessThanOrEqual(44)
      expect(token2.length).toBeGreaterThanOrEqual(42)
      expect(token2.length).toBeLessThanOrEqual(44)
    })

    it('should generate cryptographically secure tokens', () => {
      const token = generateSecureToken()

      // Token should have high entropy (no obvious patterns)
      // Check that it's not all the same character
      const uniqueChars = new Set(token.split(''))
      expect(uniqueChars.size).toBeGreaterThan(10)
    })
  })

  describe('hashToken', () => {
    it('should hash a token', () => {
      const token = 'test-token-123'
      const hash = hashToken(token)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(token)
      expect(hash.length).toBe(64) // SHA-256 produces 64 character hex string
    })

    it('should produce same hash for same token', () => {
      const token = 'test-token-123'
      const hash1 = hashToken(token)
      const hash2 = hashToken(token)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different tokens', () => {
      const token1 = 'test-token-123'
      const token2 = 'test-token-456'
      const hash1 = hashToken(token1)
      const hash2 = hashToken(token2)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty token', () => {
      const token = ''
      const hash = hashToken(token)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(64)
    })

    it('should handle special characters in token', () => {
      const token = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const hash = hashToken(token)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[a-f0-9]+$/) // Should be valid hex
    })

    it('should be case-sensitive', () => {
      const token1 = 'Token-ABC'
      const token2 = 'token-abc'
      const hash1 = hashToken(token1)
      const hash2 = hashToken(token2)

      expect(hash1).not.toBe(hash2)
    })

    it('should work with generateSecureToken output', () => {
      const token = generateSecureToken()
      const hash = hashToken(token)

      expect(hash).toBeDefined()
      expect(hash.length).toBe(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })
  })
})
