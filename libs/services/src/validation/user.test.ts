import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { usernameSchema, passwordSchema, emailSchema } from './user.js'

/**
 * The issues a schema raised for a value.
 *
 * Every rule in these schemas rejects with a ZodError, so asserting only that
 * one was thrown lets a value fail the wrong rule — a 21-character username is
 * rejected by `max` whether or not `regex` is right. The message is what tells
 * the two apart, and it is also what reaches the user.
 */
function issuesFor(schema: z.ZodType, value: unknown): z.ZodError['issues'] {
  const result = schema.safeParse(value)
  if (result.success) {
    throw new Error(`expected ${JSON.stringify(value)} to be rejected`)
  }
  return result.error.issues
}

function messageFor(schema: z.ZodType, value: unknown): string {
  return issuesFor(schema, value)[0].message
}

describe('User Validation Schemas', () => {
  describe('usernameSchema', () => {
    it('should accept valid usernames', () => {
      expect(usernameSchema.parse('validuser')).toBe('validuser')
      expect(usernameSchema.parse('user123')).toBe('user123')
      expect(usernameSchema.parse('user_name')).toBe('user_name')
    })

    it.each([
      ['ab', 'Username must be at least 3 characters'],
      ['a'.repeat(21), 'Username must be at most 20 characters'],
      [
        'user-name',
        'Username can only contain letters, numbers, and underscores',
      ],
      [
        'user@name',
        'Username can only contain letters, numbers, and underscores',
      ],
    ])('rejects %j for the stated reason', (value, message) => {
      expect(messageFor(usernameSchema, value)).toBe(message)
    })

    it('reports both the length and the character rule when both are broken', () => {
      expect(
        issuesFor(usernameSchema, 'a-').map(issue => issue.message)
      ).toEqual([
        'Username must be at least 3 characters',
        'Username can only contain letters, numbers, and underscores',
      ])
    })
  })

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(passwordSchema.parse('password12345')).toBe('password12345')
      expect(passwordSchema.parse('P@ssw0rd!abcd')).toBe('P@ssw0rd!abcd')
    })

    it.each([
      ['short', 'Password must be at least 12 characters'],
      ['only11chars', 'Password must be at least 12 characters'],
      ['a'.repeat(101), 'Password must be at most 100 characters'],
    ])('rejects %j for the stated reason', (value, message) => {
      expect(messageFor(passwordSchema, value)).toBe(message)
    })

    // The boundary the "under 12" case sits against: 12 is the first accepted
    // length, so the min rule is off-by-one if this fails.
    it('accepts a password of exactly the minimum length', () => {
      expect(passwordSchema.parse('a'.repeat(12))).toHaveLength(12)
    })
  })

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.parse('user@example.com')).toBe('user@example.com')
      expect(emailSchema.parse('test.email+tag@domain.co.uk')).toBe(
        'test.email+tag@domain.co.uk'
      )
    })

    it.each([['invalid-email'], ['user@'], ['@domain.com']])(
      'rejects %j as a malformed address rather than on length',
      value => {
        expect(messageFor(emailSchema, value)).toBe('Invalid email address')
      }
    )

    it('rejects an over-long but well-formed address on length', () => {
      const local = 'a'.repeat(95)

      expect(messageFor(emailSchema, `${local}@example.com`)).toBe(
        'Email must be at most 100 characters'
      )
    })
  })
})
