import { describe, it, expect } from 'vitest'
import {
  isBlockedIpAddress,
  isBlockedIpv4,
  isBlockedIpv6,
} from './ip-address.js'

describe('isBlockedIpv4', () => {
  it.each([
    ['0.0.0.0', 'this network — reaches the local host'],
    ['10.1.2.3', 'RFC 1918'],
    ['127.0.0.1', 'loopback'],
    ['127.255.255.254', 'loopback, not just 127.0.0.1'],
    ['169.254.169.254', 'cloud metadata'],
    ['172.16.0.1', 'RFC 1918, bottom of the range'],
    ['172.31.255.255', 'RFC 1918, top of the range'],
    ['192.168.1.1', 'RFC 1918'],
  ])('blocks %s (%s)', address => {
    expect(isBlockedIpv4(address)).toBe(true)
  })

  it.each([
    ['8.8.8.8'],
    ['93.184.216.34'],
    // The bug the prefix-string version had: only 172.16–172.31 is private.
    ['172.15.0.1'],
    ['172.32.0.1'],
    ['169.253.0.1'],
  ])('allows %s', address => {
    expect(isBlockedIpv4(address)).toBe(false)
  })

  it('blocks anything it cannot parse as an address', () => {
    expect(isBlockedIpv4('not-an-address')).toBe(true)
    expect(isBlockedIpv4('1.2.3')).toBe(true)
    expect(isBlockedIpv4('1.2.3.999')).toBe(true)
  })
})

describe('isBlockedIpv6', () => {
  it.each([
    ['::1', 'loopback'],
    ['::', 'unspecified'],
    ['fd00::1', 'unique local'],
    ['fe80::1', 'link-local'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:169.254.169.254', 'IPv4-mapped cloud metadata'],
  ])('blocks %s (%s)', address => {
    expect(isBlockedIpv6(address)).toBe(true)
  })

  it.each([['2606:2800:220:1:248:1893:25c8:1946'], ['::ffff:8.8.8.8']])(
    'allows %s',
    address => {
      expect(isBlockedIpv6(address)).toBe(false)
    }
  )

  it('blocks anything it cannot parse as an address', () => {
    expect(isBlockedIpv6('zzzz::1')).toBe(true)
    expect(isBlockedIpv6('1::2::3')).toBe(true)
  })
})

describe('isBlockedIpAddress', () => {
  it('dispatches on the family a DNS answer carries', () => {
    expect(isBlockedIpAddress('169.254.169.254', 4)).toBe(true)
    expect(isBlockedIpAddress('8.8.8.8', 4)).toBe(false)
    expect(isBlockedIpAddress('fd00::1', 6)).toBe(true)
  })

  // Fail closed: a family we do not recognise is a check we did not perform.
  it('blocks an address whose family it does not recognise', () => {
    expect(isBlockedIpAddress('8.8.8.8', 0)).toBe(true)
  })
})
