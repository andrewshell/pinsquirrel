import { describe, expect, it } from 'vitest'
import { formatLastSync, parseBaseUrl } from './format.ts'

describe('parseBaseUrl', () => {
  it('keeps an https origin as it was typed', () => {
    expect(parseBaseUrl('https://pinsquirrel.com')).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('drops a trailing slash, so one server has one spelling', () => {
    expect(parseBaseUrl('https://pinsquirrel.com/')).toBe(
      'https://pinsquirrel.com'
    )
  })

  it('accepts a local http server, port and all', () => {
    expect(parseBaseUrl('  http://localhost:8100/  ')).toBe(
      'http://localhost:8100'
    )
  })

  it('rejects an address with no scheme', () => {
    expect(parseBaseUrl('pinsquirrel.com')).toBeNull()
  })

  it('rejects a scheme that is not http or https', () => {
    expect(parseBaseUrl('ftp://pinsquirrel.com')).toBeNull()
    expect(parseBaseUrl('javascript:alert(1)')).toBeNull()
    expect(parseBaseUrl('chrome-extension://abc/popup.html')).toBeNull()
  })

  it('rejects anything past the origin, which discovery could not use', () => {
    // Both well-known documents live at the root of the origin (RFC 9728 3.1),
    // so a base URL carrying a path would send discovery somewhere else.
    expect(parseBaseUrl('https://pinsquirrel.com/app')).toBeNull()
    expect(parseBaseUrl('https://pinsquirrel.com/?next=1')).toBeNull()
    expect(parseBaseUrl('https://pinsquirrel.com/#top')).toBeNull()
  })

  it('rejects credentials smuggled into the authority', () => {
    expect(parseBaseUrl('https://user:pass@pinsquirrel.com')).toBeNull()
  })

  it('rejects an empty box', () => {
    expect(parseBaseUrl('   ')).toBeNull()
  })
})

describe('formatLastSync', () => {
  const now = Date.parse('2026-08-26T12:00:00Z')

  it('says so when there has never been a sync', () => {
    expect(formatLastSync(undefined, now)).toBe('Never synced')
  })

  it('reads seconds ago as just now', () => {
    expect(formatLastSync(now - 20_000, now)).toBe('Last synced just now')
  })

  it('counts whole minutes', () => {
    expect(formatLastSync(now - 60_000, now)).toBe('Last synced 1 minute ago')
    expect(formatLastSync(now - 5 * 60_000, now)).toBe(
      'Last synced 5 minutes ago'
    )
  })

  it('counts whole hours', () => {
    expect(formatLastSync(now - 60 * 60_000, now)).toBe(
      'Last synced 1 hour ago'
    )
    expect(formatLastSync(now - 7 * 60 * 60_000, now)).toBe(
      'Last synced 7 hours ago'
    )
  })

  it('counts whole days', () => {
    expect(formatLastSync(now - 24 * 60 * 60_000, now)).toBe(
      'Last synced 1 day ago'
    )
    expect(formatLastSync(now - 30 * 24 * 60 * 60_000, now)).toBe(
      'Last synced 30 days ago'
    )
  })

  it('reads a timestamp from the future as just now rather than negative', () => {
    expect(formatLastSync(now + 5 * 60_000, now)).toBe('Last synced just now')
  })
})
