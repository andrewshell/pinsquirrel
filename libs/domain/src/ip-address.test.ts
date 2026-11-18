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
    ['100.64.0.1', 'shared address space (CGNAT)'],
    ['100.100.100.200', 'shared address space, a cloud metadata service'],
    ['192.0.0.1', 'IETF protocol assignments'],
    ['192.0.2.1', 'documentation'],
    ['198.18.0.1', 'benchmarking'],
    ['198.51.100.1', 'documentation'],
    ['203.0.113.1', 'documentation'],
    ['224.0.0.1', 'multicast'],
    ['240.0.0.1', 'reserved'],
    ['255.255.255.255', 'limited broadcast'],
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
    ['100.63.255.255'],
    ['100.128.0.1'],
    ['198.20.0.1'],
    ['223.255.255.255'],
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
    ['64:ff9b::a9fe:a9fe', 'NAT64 carrying 169.254.169.254'],
    ['64:ff9b::a00:1', 'NAT64 carrying 10.0.0.1'],
    ['2002:a9fe:a9fe::1', '6to4 carrying 169.254.169.254'],
    ['::a9fe:a9fe', 'IPv4-compatible 169.254.169.254'],
    ['fec0::1', 'site-local'],
    ['ff02::1', 'multicast'],
    ['64:ff9b:1::1', 'local-use NAT64'],
    ['2001:db8::1', 'documentation'],
    ['2001::1', 'Teredo, which carries an IPv4 address of its own'],
  ])('blocks %s (%s)', address => {
    expect(isBlockedIpv6(address)).toBe(true)
  })

  it.each([
    ['2606:2800:220:1:248:1893:25c8:1946', 'global unicast'],
    ['::ffff:8.8.8.8', 'IPv4-mapped 8.8.8.8'],
    ['64:ff9b::808:808', 'NAT64 carrying 8.8.8.8'],
    ['2002:808:808::1', '6to4 carrying 8.8.8.8'],
  ])('allows %s (%s)', address => {
    expect(isBlockedIpv6(address)).toBe(false)
  })

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
