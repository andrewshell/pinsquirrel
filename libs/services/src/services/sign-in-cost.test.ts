import { scrypt } from 'node:crypto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@pinsquirrel/domain'
import { InvalidCredentialsError, Role, UserStatus } from '@pinsquirrel/domain'
import { createMockUserRepository } from '../test-utils.js'
import { hashPassword } from '../utils/crypto.js'
import { AuthenticationService } from './authentication.js'

vi.mock('node:crypto', async importOriginal => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return { ...actual, scrypt: vi.fn(actual.scrypt) }
})

const LEGACY_HASH = 'c2FsdA==:a2V5'

function userWith(passwordHash: string): User {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'someone',
    passwordHash,
    emailHash: null,
    emailEncrypted: null,
    roles: [Role.User],
    status: UserStatus.Active,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('sign-in key derivation cost', () => {
  let currentHash: string

  beforeEach(async () => {
    currentHash = await hashPassword('the-real-password')
  })

  async function derivationsForFailedSignIn(
    user: User | null
  ): Promise<string[]> {
    const repository = createMockUserRepository()
    vi.mocked(repository.findByUsername).mockResolvedValue(user)
    const service = new AuthenticationService(repository)
    vi.mocked(scrypt).mockClear()

    await expect(
      service.login({ username: 'someone', password: 'a-wrong-password' })
    ).rejects.toThrow(InvalidCredentialsError)

    return vi
      .mocked(scrypt)
      .mock.calls.map(call => {
        const { N, r, p } = call[3]
        return `N=${N} r=${r} p=${p}`
      })
      .sort()
  }

  it('is the same for an unknown user, a legacy hash and a current hash', async () => {
    const unknown = await derivationsForFailedSignIn(null)
    const legacy = await derivationsForFailedSignIn(userWith(LEGACY_HASH))
    const current = await derivationsForFailedSignIn(userWith(currentHash))

    expect(unknown.length).toBeGreaterThan(0)
    expect(legacy).toEqual(unknown)
    expect(current).toEqual(unknown)
  })
})
