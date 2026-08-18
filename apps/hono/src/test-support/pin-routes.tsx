/**
 * Shared fixtures for the pin route characterization tests.
 *
 * `pins.tsx` and `private.tsx` are near-identical today, so their tests need
 * the same fakes. Keeping them here means the suites can be compared directly —
 * a behavior only one of them asserts is a real divergence, not a difference in
 * test setup.
 */
import { vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Pin, Tag, User } from '@pinsquirrel/domain'

export const testUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@example.com',
} as unknown as User

export function makePin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1',
    userId: 'user-1',
    url: 'https://example.com',
    title: 'Example Pin',
    description: null,
    readLater: false,
    isPrivate: false,
    tagNames: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

export function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 'tag-1',
    userId: 'user-1',
    name: 'foo',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

/** Mock fns for `../lib/services`, shared by both route suites. */
export interface ServiceMocks {
  getPin: Mock
  createPin: Mock
  updatePin: Mock
  deletePin: Mock
  getUserPinsWithPagination: Mock
  findByUrl: Mock
  getUserTags: Mock
  login: Mock
}

export function createServiceMocks(): ServiceMocks {
  return {
    getPin: vi.fn(),
    createPin: vi.fn(),
    updatePin: vi.fn(),
    deletePin: vi.fn(),
    getUserPinsWithPagination: vi.fn(),
    findByUrl: vi.fn(),
    getUserTags: vi.fn(),
    login: vi.fn(),
  }
}

/**
 * Mock fns backing the fake `SessionManager`.
 *
 * `authUser` stands in for `getAuthUser(c)`, which routes behind `requireAuth`
 * use to read the already-resolved user. It is synchronous, unlike the async
 * `getUser` on the session manager — mixing them up hands the route a Promise.
 */
export interface SessionMocks {
  getUser: Mock
  authUser: Mock
  setFlash: Mock
  getFlash: Mock
  isPrivateUnlocked: Mock
  unlockPrivateMode: Mock
  lockPrivateMode: Mock
}

export function createSessionMocks(): SessionMocks {
  return {
    getUser: vi.fn(),
    authUser: vi.fn(),
    setFlash: vi.fn(),
    getFlash: vi.fn(),
    isPrivateUnlocked: vi.fn(),
    unlockPrivateMode: vi.fn(),
    lockPrivateMode: vi.fn(),
  }
}

/**
 * A fake SessionManager covering the whole interface. Routes reach for
 * `getFlash()` during render, so a partial fake fails at render time rather
 * than at the assertion.
 */
export function fakeSessionManager(mocks: SessionMocks) {
  return {
    getSession: () => null,
    getData: () => null,
    getUserId: () => testUser.id,
    isAuthenticated: () => true,
    create: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
    getUser: (...a: unknown[]) => mocks.getUser(...a) as unknown,
    setFlash: (...a: unknown[]) => mocks.setFlash(...a) as unknown,
    getFlash: (...a: unknown[]) => mocks.getFlash(...a) as unknown,
    isPrivateUnlocked: (...a: unknown[]) =>
      mocks.isPrivateUnlocked(...a) as unknown,
    unlockPrivateMode: (...a: unknown[]) =>
      mocks.unlockPrivateMode(...a) as unknown,
    lockPrivateMode: (...a: unknown[]) =>
      mocks.lockPrivateMode(...a) as unknown,
  }
}

/** Encode a record as an HTML form body, the way the routes receive it. */
export function formBody(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  }
}
