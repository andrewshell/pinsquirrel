/**
 * Spec for the bulk/plain-text sender.
 *
 * Moved here from `apps/admin/src/mailer.test.ts`, which was the spec for the
 * admin console's own Mailgun client before that client was folded into this
 * package. The assertions are unchanged: they are what the operator console
 * depends on.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MailgunEmailService } from './email-service.js'
import { isTransient } from './retry.js'

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
  let service: MailgunEmailService

  beforeEach(() => {
    createMock.mockReset()
    service = new MailgunEmailService(settings)
  })

  it('sends one isolated message per recipient', async () => {
    createMock.mockResolvedValue({ id: 'ok' })

    const results = await service.sendBulk(
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

    const results = await service.sendBulk(
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

  // The retry was the reason the admin console kept its own client. It has to
  // survive the move, or a transient blip drops a waitlist announcement.
  it('retries a transient failure and reports the eventual success', async () => {
    vi.useFakeTimers()
    createMock
      .mockRejectedValueOnce(
        Object.assign(new Error('gateway timeout'), { status: 504 })
      )
      .mockResolvedValueOnce({ id: 'ok' })

    const pending = service.sendBulk(['a@example.com'], 'S', 'B')
    await vi.runAllTimersAsync()
    const results = await pending
    vi.useRealTimers()

    expect(createMock).toHaveBeenCalledTimes(2)
    expect(results).toEqual([{ recipient: 'a@example.com', ok: true }])
  })

  it('gives up after three attempts on a persistently transient failure', async () => {
    vi.useFakeTimers()
    createMock.mockRejectedValue(
      Object.assign(new Error('service unavailable'), { status: 503 })
    )

    const pending = service.sendBulk(['a@example.com'], 'S', 'B')
    await vi.runAllTimersAsync()
    const results = await pending
    vi.useRealTimers()

    expect(createMock).toHaveBeenCalledTimes(3)
    expect(results).toEqual([
      {
        recipient: 'a@example.com',
        ok: false,
        error: 'service unavailable',
      },
    ])
  })
})

describe('sendPlainText', () => {
  let service: MailgunEmailService

  beforeEach(() => {
    createMock.mockReset()
    service = new MailgunEmailService(settings)
  })

  it('posts a text-only message with no html part', async () => {
    createMock.mockResolvedValue({ id: 'ok' })

    await service.sendPlainText('a@example.com', 'Hello', 'Body text')

    expect(createMock).toHaveBeenCalledWith('mg.test', {
      from: 'Test <no-reply@test>',
      to: ['a@example.com'],
      subject: 'Hello',
      text: 'Body text',
    })
  })

  it('names the recipient when the send fails', async () => {
    createMock.mockRejectedValue(
      Object.assign(new Error('bad request'), { status: 400 })
    )

    await expect(
      service.sendPlainText('a@example.com', 'Hello', 'Body text')
    ).rejects.toThrow(/a@example\.com/)
  })
})
