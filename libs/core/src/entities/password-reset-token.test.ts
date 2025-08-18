import { describe, it, expect } from 'vitest'
import type {
  PasswordResetToken,
  CreatePasswordResetTokenData,
  PasswordResetRequest,
  PasswordResetConfirmation,
} from './password-reset-token.js'

describe('PasswordResetToken Entity', () => {
  it('should have correct interface structure', () => {
    const token: PasswordResetToken = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userId: '456e7890-e12b-34d5-a678-912345678901',
      tokenHash: 'hashed_token_value',
      expiresAt: new Date('2025-08-18T15:00:00Z'),
      createdAt: new Date('2025-08-18T14:45:00Z'),
    }

    expect(token.id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(token.userId).toBe('456e7890-e12b-34d5-a678-912345678901')
    expect(token.tokenHash).toBe('hashed_token_value')
    expect(token.expiresAt).toBeInstanceOf(Date)
    expect(token.createdAt).toBeInstanceOf(Date)
  })

  it('should have valid CreatePasswordResetTokenData structure', () => {
    const createData: CreatePasswordResetTokenData = {
      userId: '456e7890-e12b-34d5-a678-912345678901',
      tokenHash: 'hashed_token_value',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
    }

    expect(createData.userId).toBe('456e7890-e12b-34d5-a678-912345678901')
    expect(createData.tokenHash).toBe('hashed_token_value')
    expect(createData.expiresAt).toBeInstanceOf(Date)
    expect(createData.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('should validate expiration time is in the future for creation', () => {
    const futureTime = new Date(Date.now() + 15 * 60 * 1000)
    const createData: CreatePasswordResetTokenData = {
      userId: '456e7890-e12b-34d5-a678-912345678901',
      tokenHash: 'hashed_token_value',
      expiresAt: futureTime,
    }

    expect(createData.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})

describe('PasswordResetRequest Entity', () => {
  it('should have correct interface structure', () => {
    const request: PasswordResetRequest = {
      email: 'user@example.com',
    }

    expect(request.email).toBe('user@example.com')
    expect(typeof request.email).toBe('string')
  })

  it('should accept valid email formats', () => {
    const validEmails = [
      'user@example.com',
      'test.user+tag@domain.co.uk',
      'user123@subdomain.example.org',
    ]

    validEmails.forEach(email => {
      const request: PasswordResetRequest = { email }
      expect(request.email).toBe(email)
    })
  })
})

describe('PasswordResetConfirmation Entity', () => {
  it('should have correct interface structure', () => {
    const confirmation: PasswordResetConfirmation = {
      token: 'raw_token_value',
      newPassword: 'newSecurePassword123',
    }

    expect(confirmation.token).toBe('raw_token_value')
    expect(confirmation.newPassword).toBe('newSecurePassword123')
    expect(typeof confirmation.token).toBe('string')
    expect(typeof confirmation.newPassword).toBe('string')
  })

  it('should accept various password formats', () => {
    const passwords = [
      'simplePassword',
      'Complex@Password123!',
      'multiple words with spaces',
      '12345',
    ]

    passwords.forEach(password => {
      const confirmation: PasswordResetConfirmation = {
        token: 'token_value',
        newPassword: password,
      }
      expect(confirmation.newPassword).toBe(password)
    })
  })

  it('should require both token and newPassword', () => {
    const confirmation: PasswordResetConfirmation = {
      token: 'test_token',
      newPassword: 'testPassword',
    }

    // Both fields should be required (TypeScript will enforce this)
    expect(confirmation.token).toBeDefined()
    expect(confirmation.newPassword).toBeDefined()
    expect(confirmation.token.length).toBeGreaterThan(0)
    expect(confirmation.newPassword.length).toBeGreaterThan(0)
  })
})