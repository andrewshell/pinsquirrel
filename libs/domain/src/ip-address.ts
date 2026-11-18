/**
 * Which IP addresses must never be fetched, expressed as ranges.
 *
 * This lives in the domain because two layers need the same answer and must
 * not drift apart: `libs/services` checks the literal address in a URL before
 * a fetch is attempted, and `libs/adapters` checks the addresses a hostname
 * actually resolves to at connect time. Neither check is sufficient on its
 * own, and two copies of the range list would be worse than either.
 *
 * Pure by construction — no imports, including `node:net`, so the rule that
 * `libs/domain` has no dependencies still holds. The one thing `net.isIP`
 * was used for is a dotted-quad check, spelled out below.
 */

/**
 * IPv4 ranges that must never be fetched, as [network, prefix length]: every
 * block in the IANA special-purpose registry that is not globally reachable,
 * and the documentation and benchmarking blocks besides. None of them is
 * somewhere a public web server lives, and several are somewhere a private
 * one does.
 *
 * Prefix-string matching cannot express these: it blocks all of `172.*` when
 * only `172.16.0.0/12` is private, and it misses `169.254.169.254` — the cloud
 * metadata endpoint, the single most valuable SSRF target.
 */
const BLOCKED_IPV4_CIDRS: [string, number][] = [
  ['0.0.0.0', 8], // "this network" — 0.0.0.0 reaches the local host
  ['10.0.0.0', 8], // RFC 1918 private
  ['100.64.0.0', 10], // shared address space: CGNAT, Tailscale, cloud internals
  ['127.0.0.0', 8], // loopback, not just 127.0.0.1
  ['169.254.0.0', 16], // link-local, including cloud metadata
  ['172.16.0.0', 12], // RFC 1918 private — 172.16–172.31 only
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // retired 6to4 relay anycast
  ['192.168.0.0', 16], // RFC 1918 private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, and 255.255.255.255 broadcast
]

/** Is this four dot-separated decimal octets, each within range? */
function isDottedQuad(value: string): boolean {
  const octets = value.split('.')
  if (octets.length !== 4) return false

  return octets.every(octet => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
}

/** Parse a dotted-quad into a 32-bit integer. */
function ipv4ToInt(address: string): number {
  return address.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0)
}

export function isBlockedIpv4(address: string): boolean {
  // An address we cannot parse is not an address we are willing to fetch.
  if (!isDottedQuad(address)) return true

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
        if (!isDottedQuad(group)) return null
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

/**
 * Global unicast is `2000::/3`. Everything outside it (loopback, unique local,
 * link-local, site-local, multicast, local-use NAT64) is somewhere other than
 * the public internet, so the IPv6 check allows in rather than blocks out.
 */
function isGlobalUnicast(bytes: number[]): boolean {
  return (bytes[0] & 0xe0) === 0x20
}

/**
 * The IPv4 address an IPv6 address carries, when it is one of the forms that
 * route to that IPv4 address: IPv4-mapped (`::ffff:0:0/96`), IPv4-compatible
 * (`::/96`, which also covers `::` and `::1`), NAT64 (`64:ff9b::/96`) and
 * 6to4 (`2002::/16`). Deciding on the IPv6 form alone would let
 * `64:ff9b::a9fe:a9fe` reach `169.254.169.254` through a NAT64 gateway.
 */
function embeddedIpv4(bytes: number[]): string | null {
  const zeros = (from: number, to: number) =>
    bytes.slice(from, to).every(byte => byte === 0)

  if (zeros(0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return bytes.slice(12).join('.')
  }
  if (zeros(0, 12)) return bytes.slice(12).join('.')
  const isNat64 =
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    zeros(4, 12)
  if (isNat64) return bytes.slice(12).join('.')
  if (bytes[0] === 0x20 && bytes[1] === 0x02) return bytes.slice(2, 6).join('.')
  return null
}

export function isBlockedIpv6(address: string): boolean {
  const bytes = ipv6ToBytes(address)
  // An address we cannot parse is not an address we are willing to fetch.
  if (bytes === null) return true

  const ipv4 = embeddedIpv4(bytes)
  if (ipv4 !== null) return isBlockedIpv4(ipv4)

  if (!isGlobalUnicast(bytes)) return true

  // 2001::/23 IETF protocol assignments, including Teredo (2001::/32), which
  // carries an obfuscated IPv4 address of its own.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] < 0x02) return true

  // 2001:db8::/32 and 3fff::/20 documentation
  const isDocumentation2001 =
    bytes[0] === 0x20 &&
    bytes[1] === 0x01 &&
    bytes[2] === 0x0d &&
    bytes[3] === 0xb8
  if (isDocumentation2001) return true
  if (bytes[0] === 0x3f && bytes[1] === 0xff && bytes[2] < 0x10) return true

  return false
}

/**
 * As above, for a caller that already knows the address family — a DNS answer
 * carries it, so nothing has to sniff the string to decide which check to run.
 * An unrecognised family is treated as unsafe.
 */
export function isBlockedIpAddress(address: string, family: number): boolean {
  if (family === 4) return isBlockedIpv4(address)
  if (family === 6) return isBlockedIpv6(address)
  return true
}
