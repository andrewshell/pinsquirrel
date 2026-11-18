import type { UserRepository } from '@pinsquirrel/domain'
import { vi } from 'vitest'

/**
 * A `UserRepository` whose every method is an unconfigured `vi.fn()`.
 *
 * Four service test files used to spell this object out; when the interface
 * gains a method they all had to be edited, and a missing one only showed up
 * as a type error in whichever file was touched next.
 */
export function createMockUserRepository(): UserRepository {
  return {
    findById: vi.fn(),
    findByEmailHash: vi.fn(),
    findByUsername: vi.fn(),
    findByStatus: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    countByRole: vi.fn(),
    replacePasswordHash: vi.fn(),
    deleteStaleUnverified: vi.fn(),
    revokeSessionsAndTokens: vi.fn(),
  }
}

export function createDeferQueue() {
  const pending: Promise<void>[] = []
  return {
    defer: (work: () => Promise<void>) => {
      const run = work()
      run.catch(() => undefined)
      pending.push(run)
    },
    flush: async () => {
      while (pending.length > 0) {
        await Promise.all(pending.splice(0))
      }
    },
  }
}
