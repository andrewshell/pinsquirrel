import { describe, it, expect } from 'vitest'
import { formatDate } from './format-date'

describe('formatDate', () => {
  it('renders the time in UTC and says so, whatever zone the server runs in', () => {
    expect(formatDate(new Date('2024-01-01T23:30:00Z'))).toBe(
      'January 1, 2024 at 11:30 PM UTC'
    )
  })
})
