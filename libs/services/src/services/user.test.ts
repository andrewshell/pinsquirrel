/**
 * Tests for UserService.listByStatus.
 *
 * UserService had no tests; these cover the method added for the admin
 * waitlist page. getUser/getUserByUsername/updateUser remain uncovered.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserService } from './user.js'
import type { User, UserRepository } from '@pinsquirrel/domain'
import {
  AccessControl,
  MissingRoleError,
  Role,
  UserStatus,
} from '@pinsquirrel/domain'

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    username: 'alice',
    passwordHash: 'x',
    emailHash: null,
    emailEncrypted: null,
    roles: [Role.User],
    status: UserStatus.Waitlist,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

const admin = makeUser({
  id: 'admin-1',
  username: 'root',
  roles: [Role.User, Role.Admin],
  status: UserStatus.Active,
})

const plainUser = makeUser({ id: 'plain-1', roles: [Role.User] })

let service: UserService
let mockRepo: UserRepository

beforeEach(() => {
  mockRepo = {
    findById: vi.fn(),
    findByEmailHash: vi.fn(),
    findByUsername: vi.fn(),
    findByStatus: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addRole: vi.fn(),
  }
  service = new UserService(mockRepo)
})

describe('UserService.listByStatus', () => {
  it('returns the users in that lifecycle state for an admin', async () => {
    const waitlisted = [makeUser({ id: 'a' }), makeUser({ id: 'b' })]
    vi.mocked(mockRepo.findByStatus).mockResolvedValue(waitlisted)

    const result = await service.listByStatus(
      new AccessControl(admin),
      UserStatus.Waitlist
    )

    expect(mockRepo.findByStatus).toHaveBeenCalledWith(UserStatus.Waitlist)
    expect(result).toEqual(waitlisted)
  })

  // Listing every waitlisted account is how the admin app gets the addresses
  // it then decrypts, so the query carries its own authorization rather than
  // trusting whichever app happens to call it.
  it('refuses a caller without the Admin role', async () => {
    await expect(
      service.listByStatus(new AccessControl(plainUser), UserStatus.Waitlist)
    ).rejects.toBeInstanceOf(MissingRoleError)
    expect(mockRepo.findByStatus).not.toHaveBeenCalled()
  })

  it('refuses an unauthenticated caller', async () => {
    await expect(
      service.listByStatus(new AccessControl(null), UserStatus.Waitlist)
    ).rejects.toBeInstanceOf(MissingRoleError)
    expect(mockRepo.findByStatus).not.toHaveBeenCalled()
  })

  it('passes any status through, not just the waitlist', async () => {
    vi.mocked(mockRepo.findByStatus).mockResolvedValue([])

    await service.listByStatus(new AccessControl(admin), UserStatus.Unverified)

    expect(mockRepo.findByStatus).toHaveBeenCalledWith(UserStatus.Unverified)
  })
})
