import { isIP } from 'node:net'
import { InvalidUrlError, UnsupportedProtocolError } from '@pinsquirrel/domain'

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
 * IPv4 ranges that must never be fetched, as [network, prefix length].
 *
 * Prefix-string matching cannot express these: it blocks all of `172.*` when
 * only `172.16.0.0/12` is private, and it misses `169.254.169.254` — the cloud
 * metadata endpoint, the single most valuable SSRF target.
 */
const BLOCKED_IPV4_CIDRS: [string, number][] = [
  ['0.0.0.0', 8], // "this network" — 0.0.0.0 reaches the local host
  ['10.0.0.0', 8], // RFC 1918 private
  ['127.0.0.0', 8], // loopback, not just 127.0.0.1
  ['169.254.0.0', 16], // link-local, including cloud metadata
  ['172.16.0.0', 12], // RFC 1918 private — 172.16–172.31 only
  ['192.168.0.0', 16], // RFC 1918 private
]

/** Parse a dotted-quad into a 32-bit integer. */
function ipv4ToInt(address: string): number {
  return address.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0)
}

function isBlockedIpv4(address: string): boolean {
  const value = ipv4ToInt(address)

  return BLOCKED_IPV4_CIDRS.some(([network, prefix]) => {
    // `>>> 0` keeps the mask unsigned; a /0 would shift by 32, which is a no-op
    // in JS, but no entry uses one.
    const mask = (0xffffffff << (32 - prefix)) >>> 0
    return (value & mask) >>> 0 === (ipv4ToInt(network) & mask) >>> 0
  })
}

/** Expand any IPv6 form (compressed, or with a trailing dotted quad) to 16 bytes. */
function ipv6ToBytes(address: string): number[] | null {
  const [head, tail] = address.split('::')
  if (tail !== undefined && address.split('::').length > 2) return null

  const expand = (part: string): number[] | null => {
    if (part === '') return []
    const bytes: number[] = []
    for (const group of part.split(':')) {
      if (group.includes('.')) {
        // Trailing IPv4 form, e.g. `::ffff:127.0.0.1`
        if (isIP(group) !== 4) return null
        for (const octet of group.split('.')) bytes.push(Number(octet))
        continue
      }
      const value = parseInt(group, 16)
      if (Number.isNaN(value)) return null
      bytes.push(value >> 8, value & 0xff)
    }
    return bytes
  }

  const headBytes = expand(head)
  if (headBytes === null) return null

  if (tail === undefined) return headBytes.length === 16 ? headBytes : null

  const tailBytes = expand(tail)
  if (tailBytes === null) return null

  const gap = 16 - headBytes.length - tailBytes.length
  if (gap < 0) return null

  return [...headBytes, ...Array<number>(gap).fill(0), ...tailBytes]
}

function isBlockedIpv6(address: string): boolean {
  const bytes = ipv6ToBytes(address)
  // An address we cannot parse is not an address we are willing to fetch.
  if (bytes === null) return true

  // IPv4-mapped (::ffff:0:0/96): decide on the IPv4 address it carries, or
  // `::ffff:169.254.169.254` walks straight past the IPv4 list.
  const isMappedIpv4 =
    bytes.slice(0, 10).every(byte => byte === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff
  if (isMappedIpv4) {
    return isBlockedIpv4(bytes.slice(12).join('.'))
  }

  // ::1 loopback and :: unspecified
  if (bytes.slice(0, 15).every(byte => byte === 0) && bytes[15] <= 1) {
    return true
  }

  // fc00::/7 unique local
  if ((bytes[0] & 0xfe) === 0xfc) return true

  // fe80::/10 link-local
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true

  return false
}

/**
 * Check if a URL is safe for fetching (prevents SSRF attacks).
 *
 * Only the literal address in the URL is checked here. A hostname that
 * *resolves* to a private address still gets through; closing that needs a
 * custom `lookup` in the fetcher.
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
