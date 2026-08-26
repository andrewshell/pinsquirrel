/**
 * The popup's text, worked out without touching the DOM.
 *
 * Everything here is a pure function of its arguments - the clock included -
 * so the wiring tests do not have to freeze time and these can be read as the
 * spec for what the user sees.
 */

/**
 * The origin the user typed, or null if it is not one the extension can use.
 *
 * Only an origin is accepted. Both well-known documents are looked up at the
 * root of the base URL (RFC 9728 3.1), so `https://host/app` would send
 * discovery to `https://host/app/.well-known/...`, which is not where the
 * server publishes them - and the same string is what `authorizedFetch` builds
 * `/api/v1` paths on. Rejecting it here is a clear message now instead of a
 * confusing 404 halfway through the consent flow.
 *
 * `URL.origin` is what normalizes: it lowercases the host, drops the trailing
 * slash, and keeps a non-default port.
 */
export function parseBaseUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.pathname !== '/' || url.search || url.hash) return null
  // Credentials in the authority would be sent to the token endpoint as part
  // of the base URL, and no PinSquirrel server asks for them.
  if (url.username || url.password) return null

  return url.origin
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * When the last sync ran, in words.
 *
 * Relative rather than absolute, because the question the popup answers is
 * "is this stale?" and a wall-clock time makes the reader do that subtraction
 * themselves. A timestamp from the future - a clock that moved backwards -
 * reads as just now rather than as a negative age.
 */
export function formatLastSync(
  lastSyncAt: number | undefined,
  now: number
): string {
  if (lastSyncAt === undefined) return 'Never synced'

  const age = Math.max(0, now - lastSyncAt)
  if (age < MINUTE) return 'Last synced just now'
  if (age < HOUR) return `Last synced ${count(age / MINUTE, 'minute')} ago`
  if (age < DAY) return `Last synced ${count(age / HOUR, 'hour')} ago`
  return `Last synced ${count(age / DAY, 'day')} ago`
}

function count(value: number, unit: string): string {
  const whole = Math.floor(value)
  return `${whole} ${unit}${whole === 1 ? '' : 's'}`
}
