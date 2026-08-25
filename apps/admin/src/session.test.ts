/**
 * Session-store tests.
 *
 * The store is module-level state, so each test uses its own session id and
 * fake timers rather than a reset hook — there is no reset hook to call, and
 * adding one would be test-only API on a module the app depends on.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createSession, getSession, updateSession } from './session.js'

const EIGHT_HOURS = 8 * 60 * 60 * 1000

afterEach(() => {
  vi.useRealTimers()
  delete process.env.ADMIN_SESSION_TTL_MS
})

function makeData() {
  return { environment: 'test', userId: 'user-1', username: 'root' }
}

describe('session TTL', () => {
  it('returns a session inside the default eight-hour window', () => {
    vi.useFakeTimers()
    const id = createSession(makeData())

    vi.advanceTimersByTime(EIGHT_HOURS - 1000)

    expect(getSession(id)?.username).toBe('root')
  })

  // An expired session must not merely be hidden: the unlocked private key it
  // holds is the whole reason for the TTL, so the entry has to go.
  it('drops a session once the window has passed', () => {
    vi.useFakeTimers()
    const id = createSession({ ...makeData(), privateKey: 'unlocked-key' })

    vi.advanceTimersByTime(EIGHT_HOURS + 1000)

    expect(getSession(id)).toBeUndefined()
    // A second read cannot resurrect it either.
    expect(getSession(id)).toBeUndefined()
  })

  it('honours ADMIN_SESSION_TTL_MS', () => {
    process.env.ADMIN_SESSION_TTL_MS = '60000'
    vi.useFakeTimers()
    const id = createSession(makeData())

    vi.advanceTimersByTime(30_000)
    expect(getSession(id)).toBeDefined()

    vi.advanceTimersByTime(31_000)
    expect(getSession(id)).toBeUndefined()
  })

  // Expiry is absolute, not sliding: unlocking the key part-way through must
  // not buy the session another full window.
  it('does not extend the window when the session is updated', () => {
    vi.useFakeTimers()
    const id = createSession(makeData())

    vi.advanceTimersByTime(EIGHT_HOURS / 2)
    updateSession(id, { privateKey: 'unlocked-key' })
    vi.advanceTimersByTime(EIGHT_HOURS / 2 + 1000)

    expect(getSession(id)).toBeUndefined()
  })
})
