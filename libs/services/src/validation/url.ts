import { isIP } from 'node:net'
import {
  InvalidUrlError,
  UnsupportedProtocolError,
  isBlockedIpv4,
  isBlockedIpv6,
} from '@pinsquirrel/domain'

/**
 * Validates a URL for metadata fetching with security checks
 */
export function validateUrlForFetching(urlString: string): URL {
  // Basic type and empty string validation
  if (typeof urlString !== 'string' || !urlString.trim()) {
    throw new InvalidUrlError(urlString)
  }

  // Parse URL
  let url: URL
  try {
    url = new URL(urlString.trim())
  } catch {
    throw new InvalidUrlError(urlString)
  }

  // Check protocol - only HTTP and HTTPS allowed
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsupportedProtocolError(url.protocol)
  }

  // Check if hostname exists
  if (!url.hostname) {
    throw new InvalidUrlError(urlString)
  }

  // SSRF protection - block private/local addresses
  if (!isSafeForFetching(url)) {
    throw new InvalidUrlError(urlString)
  }

  return url
}

/**
 * Check if a URL is safe for fetching (prevents SSRF attacks).
 *
 * Only the literal address in the URL is checked here — the address ranges
 * themselves live in `@pinsquirrel/domain` because `NodeHttpFetcher` applies
 * the same list to the addresses a hostname actually resolves to, which is
 * the half this function cannot see.
 */
function isSafeForFetching(url: URL): boolean {
  const hostname = url.hostname.toLowerCase()

  // `URL` keeps IPv6 hosts bracketed. It also normalises the decimal, hex,
  // octal and short IPv4 forms (`2130706433`, `0x7f000001`, `127.1`) to a
  // dotted quad, so those arrive here already unmasked.
  const host = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname

  const version = isIP(host)
  if (version === 4) return !isBlockedIpv4(host)
  if (version === 6) return !isBlockedIpv6(host)

  // Not a literal address: block the names that mean "this machine" or "this
  // network segment".
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  if (hostname.endsWith('.local')) return false

  return true
}
