import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startExpirySweep, SWEEP_INTERVAL_MS } from './expiry-sweep'

const info = vi.fn()
const error = vi.fn()

vi.mock('./logger', () => ({
  logger: {
    info: (...a: unknown[]) => {
      info(...a)
    },
    error: (...a: unknown[]) => {
      error(...a)
    },
  },
  safeError: (err: unknown) => ({ message: (err as Error).message }),
}))

function makeService(result = { sessions: 0, passwordResetTokens: 0 }) {
  return { sweepExpired: vi.fn().mockResolvedValue(result) }
}

describe('startExpirySweep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    info.mockClear()
    error.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sweeps once at boot rather than waiting out the first interval', async () => {
    const service = makeService({ sessions: 4, passwordResetTokens: 1 })

    const timer = startExpirySweep(service)
    await vi.advanceTimersByTimeAsync(0)
    clearInterval(timer)

    expect(service.sweepExpired).toHaveBeenCalledOnce()
  })

  it('keeps sweeping on the interval', async () => {
    const service = makeService()

    const timer = startExpirySweep(service)
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS * 2)
    clearInterval(timer)

    // Boot, plus one per elapsed interval.
    expect(service.sweepExpired).toHaveBeenCalledTimes(3)
  })

  it('says what it removed', async () => {
    const service = makeService({ sessions: 4, passwordResetTokens: 1 })

    const timer = startExpirySweep(service)
    await vi.advanceTimersByTimeAsync(0)
    clearInterval(timer)

    expect(info).toHaveBeenCalledWith(
      { sessions: 4, passwordResetTokens: 1 },
      expect.any(String)
    )
  })

  // A sweep is housekeeping: a database blip during one must not take down a
  // server that is otherwise serving requests, and must not stop the schedule.
  it('logs a failed sweep and sweeps again next time', async () => {
    const service = makeService()
    service.sweepExpired
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValue({ sessions: 0, passwordResetTokens: 0 })

    const timer = startExpirySweep(service)
    await vi.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS)
    clearInterval(timer)

    expect(error).toHaveBeenCalled()
    expect(service.sweepExpired).toHaveBeenCalledTimes(2)
  })

  // Unref'd, so a sweep pending in the background never keeps the process
  // alive on its own - shutdown is decided by the server, not by housekeeping.
  it('does not hold the process open', () => {
    const timer = startExpirySweep(makeService())

    expect(timer.hasRef()).toBe(false)

    clearInterval(timer)
  })
})
