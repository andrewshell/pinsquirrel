import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isTransient, sendBulk } from './mailer.js'

// Mock the Mailgun client so no network calls happen and we can observe
// messages.create. vi.hoisted lets the mock factory reference createMock.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))

vi.mock('mailgun.js', () => ({
  default: class MockMailgun {
    client() {
      return { messages: { create: createMock } }
    }
  },
}))

const settings = {
  apiKey: 'key-test',
  domain: 'mg.test',
  fromEmail: 'no-reply@test',
  fromName: 'Test',
}

describe('isTransient', () => {
  it('retries on rate limiting and server errors', () => {
    expect(isTransient({ status: 429 })).toBe(true)
    expect(isTransient({ status: 500 })).toBe(true)
    expect(isTransient({ status: 503 })).toBe(true)
  })

  it('retries on network/timeout errors that carry no status', () => {
    expect(isTransient(new Error('socket hang up'))).toBe(true)
  })

  it('treats null/undefined thrown values as transient without throwing', () => {
    expect(isTransient(null)).toBe(true)
    expect(isTransient(undefined)).toBe(true)
  })

  it('does not retry on client errors', () => {
    expect(isTransient({ status: 400 })).toBe(false)
    expect(isTransient({ status: 401 })).toBe(false)
    expect(isTransient({ status: 404 })).toBe(false)
  })
})

describe('sendBulk', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('sends one isolated message per recipient', async () => {
    createMock.mockResolvedValue({ id: 'ok' })

    const results = await sendBulk(
      settings,
      ['a@example.com', 'b@example.com'],
      'Hello',
      'Body text'
    )

    expect(createMock).toHaveBeenCalledTimes(2)
    expect(createMock).toHaveBeenNthCalledWith(1, 'mg.test', {
      from: 'Test <no-reply@test>',
      to: ['a@example.com'],
      subject: 'Hello',
      text: 'Body text',
    })
    expect(createMock).toHaveBeenNthCalledWith(2, 'mg.test', {
      from: 'Test <no-reply@test>',
      to: ['b@example.com'],
      subject: 'Hello',
      text: 'Body text',
    })
    expect(results).toEqual([
      { recipient: 'a@example.com', ok: true },
      { recipient: 'b@example.com', ok: true },
    ])
  })

  it('continues after a failure and returns per-recipient results', async () => {
    // First recipient fails permanently (4xx, no retry); second succeeds.
    createMock
      .mockRejectedValueOnce(
        Object.assign(new Error('bad request'), { status: 400 })
      )
      .mockResolvedValueOnce({ id: 'ok' })

    const results = await sendBulk(
      settings,
      ['bad@example.com', 'good@example.com'],
      'S',
      'B'
    )

    expect(createMock).toHaveBeenCalledTimes(2)
    expect(results).toEqual([
      { recipient: 'bad@example.com', ok: false, error: 'bad request' },
      { recipient: 'good@example.com', ok: true },
    ])
  })
})
