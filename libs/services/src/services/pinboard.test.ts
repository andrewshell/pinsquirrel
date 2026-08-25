import type { AccessControl, Pin } from '@pinsquirrel/domain'
import { DuplicatePinError } from '@pinsquirrel/domain'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { PinService } from './pin.js'
import {
  InvalidPinboardExportError,
  PinboardService,
  type PinboardPin,
} from './pinboard.js'

describe('PinboardService', () => {
  let mockPinService: {
    createPin: Mock
    backdatePin: Mock
    getUserPins: Mock
  }
  let pinboardService: PinboardService

  // The service never inspects the AccessControl; it only passes it through.
  const ac = { user: { id: 'user-123' } } as unknown as AccessControl

  const pinboardPin = (overrides: Partial<PinboardPin> = {}): PinboardPin => ({
    href: 'https://example.com',
    description: 'Example Title',
    extended: 'A description',
    meta: 'ignored',
    hash: 'ignored',
    time: '2024-01-01T00:00:00Z',
    shared: 'no',
    toread: 'no',
    tags: 'dev tools',
    ...overrides,
  })

  const pin = (overrides: Partial<Pin> = {}): Pin => ({
    id: 'pin-1',
    userId: 'user-123',
    url: 'https://example.com',
    title: 'Example Title',
    description: 'A description',
    readLater: false,
    isPrivate: false,
    tagNames: ['dev', 'tools'],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  })

  beforeEach(() => {
    mockPinService = {
      createPin: vi.fn().mockResolvedValue(pin()),
      backdatePin: vi.fn().mockResolvedValue(pin()),
      getUserPins: vi.fn().mockResolvedValue([]),
    }
    pinboardService = new PinboardService(
      mockPinService as unknown as PinService
    )
  })

  describe('parse', () => {
    it('returns every entry of a well-formed export', () => {
      const entries = [pinboardPin(), pinboardPin({ href: 'https://b.test' })]

      expect(PinboardService.parse(JSON.stringify(entries))).toEqual(entries)
    })

    it('rejects text that is not JSON with reason malformed-json', () => {
      expect(() => PinboardService.parse('<html>nope</html>')).toThrow(
        expect.objectContaining({
          name: 'InvalidPinboardExportError',
          reason: 'malformed-json',
        })
      )
    })

    it('rejects JSON that is not an array with reason not-a-list', () => {
      expect(() => PinboardService.parse('{"href":"https://a.test"}')).toThrow(
        expect.objectContaining({ reason: 'not-a-list' })
      )
    })

    it('rejects an empty array with reason not-a-list', () => {
      expect(() => PinboardService.parse('[]')).toThrow(
        expect.objectContaining({ reason: 'not-a-list' })
      )
    })

    it.each(['href', 'description', 'time'] as const)(
      'rejects a first entry missing %s with reason wrong-shape',
      field => {
        const entry = pinboardPin({ [field]: '' })

        expect(() => PinboardService.parse(JSON.stringify([entry]))).toThrow(
          expect.objectContaining({ reason: 'wrong-shape' })
        )
      }
    )

    it('accepts a file whose later entries are malformed', () => {
      const text = JSON.stringify([pinboardPin(), { junk: true }])

      expect(PinboardService.parse(text)).toHaveLength(2)
    })

    it('reports the reason in the error message', () => {
      expect(() => PinboardService.parse('nope')).toThrow(
        new InvalidPinboardExportError('malformed-json')
      )
      expect(() => PinboardService.parse('nope')).toThrow(
        'Not a valid Pinboard export: malformed-json'
      )
    })
  })

  describe('importPins', () => {
    it('maps every Pinboard field onto the created pin', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ toread: 'yes', time: '2019-07-04T12:30:45Z' }),
      ])

      expect(mockPinService.createPin).toHaveBeenCalledWith(ac, {
        userId: 'user-123',
        url: 'https://example.com',
        title: 'Example Title',
        description: 'A description',
        readLater: true,
        isPrivate: false,
        tagNames: ['dev', 'tools'],
        createdAt: new Date('2019-07-04T12:30:45Z'),
        updatedAt: new Date('2019-07-04T12:30:45Z'),
      })
    })

    it('imports pins unread unless toread is exactly "yes"', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ toread: 'YES' }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].readLater).toBe(false)
    })

    it('ignores the shared flag and imports every pin public', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ shared: 'no' }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].isPrivate).toBe(false)
    })

    it('splits tags on spaces and drops empty ones', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ tags: '  dev   tools,ops  ' }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].tagNames).toEqual([
        'dev',
        'tools,ops',
      ])
    })

    it('falls back to the URL when the title is blank', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ description: '   ' }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].title).toBe(
        'https://example.com'
      )
    })

    it('truncates a title to 200 characters', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ description: 'a'.repeat(250) }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].title).toBe(
        'a'.repeat(200)
      )
    })

    it('leaves a 200-character title intact', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ description: 'a'.repeat(200) }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].title).toHaveLength(200)
    })

    it('truncates a description to 1000 characters', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ extended: 'b'.repeat(1500) }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].description).toBe(
        'b'.repeat(1000)
      )
    })

    it('stores a missing extended field as null', async () => {
      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ extended: '' }),
      ])

      expect(mockPinService.createPin.mock.calls[0][1].description).toBeNull()
    })

    it('counts every successful create', async () => {
      const result = await pinboardService.importPins(ac, 'user-123', [
        pinboardPin(),
        pinboardPin({ href: 'https://b.test' }),
      ])

      expect(result).toMatchObject({ imported: 2, skipped: 0 })
    })

    it('collects the tags of every entry, imported or skipped', async () => {
      mockPinService.createPin.mockRejectedValueOnce(
        new DuplicatePinError('https://example.com')
      )

      const result = await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ tags: 'dev tools' }),
        pinboardPin({ href: 'https://b.test', tags: 'tools ops' }),
      ])

      expect([...result.tagNames].sort()).toEqual(['dev', 'ops', 'tools'])
    })

    it('counts a duplicate URL as skipped rather than failing the run', async () => {
      mockPinService.createPin
        .mockRejectedValueOnce(new DuplicatePinError('https://example.com'))
        .mockResolvedValueOnce(pin())

      const result = await pinboardService.importPins(ac, 'user-123', [
        pinboardPin(),
        pinboardPin({ href: 'https://b.test' }),
      ])

      expect(result).toMatchObject({ imported: 1, skipped: 1 })
    })

    it('backdates an existing pin when the export entry is older', async () => {
      mockPinService.createPin.mockRejectedValueOnce(
        new DuplicatePinError('https://example.com', {
          id: 'pin-9',
          createdAt: new Date('2024-06-01T00:00:00Z'),
        })
      )

      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ time: '2020-01-01T00:00:00Z' }),
      ])

      expect(mockPinService.backdatePin).toHaveBeenCalledWith(
        ac,
        'pin-9',
        new Date('2020-01-01T00:00:00Z')
      )
    })

    it('leaves an existing pin alone when the export entry is newer', async () => {
      mockPinService.createPin.mockRejectedValueOnce(
        new DuplicatePinError('https://example.com', {
          id: 'pin-9',
          createdAt: new Date('2020-01-01T00:00:00Z'),
        })
      )

      await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ time: '2024-06-01T00:00:00Z' }),
      ])

      expect(mockPinService.backdatePin).not.toHaveBeenCalled()
    })

    it('does not backdate when the duplicate carries no existing pin', async () => {
      mockPinService.createPin.mockRejectedValueOnce(
        new DuplicatePinError('https://example.com')
      )

      const result = await pinboardService.importPins(ac, 'user-123', [
        pinboardPin({ time: '1999-01-01T00:00:00Z' }),
      ])

      expect(mockPinService.backdatePin).not.toHaveBeenCalled()
      expect(result.skipped).toBe(1)
    })

    it('still counts the pin as skipped when backdating fails', async () => {
      const backdateError = new Error('db down')
      mockPinService.createPin.mockRejectedValueOnce(
        new DuplicatePinError('https://example.com', {
          id: 'pin-9',
          createdAt: new Date('2024-06-01T00:00:00Z'),
        })
      )
      mockPinService.backdatePin.mockRejectedValueOnce(backdateError)
      const onPinError = vi.fn()

      const entry = pinboardPin({ time: '2020-01-01T00:00:00Z' })
      const result = await pinboardService.importPins(
        ac,
        'user-123',
        [entry],
        onPinError
      )

      expect(onPinError).toHaveBeenCalledWith(backdateError, entry)
      expect(result).toMatchObject({ imported: 0, skipped: 1 })
    })

    it('reports a non-duplicate failure and carries on with the next entry', async () => {
      const failure = new Error('validation failed')
      mockPinService.createPin
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(pin())
      const onPinError = vi.fn()

      const bad = pinboardPin({ href: 'not-a-url' })
      const result = await pinboardService.importPins(
        ac,
        'user-123',
        [bad, pinboardPin({ href: 'https://b.test' })],
        onPinError
      )

      expect(onPinError).toHaveBeenCalledWith(failure, bad)
      expect(result).toMatchObject({ imported: 1, skipped: 0 })
    })

    it('survives a failing entry when no error callback is given', async () => {
      mockPinService.createPin.mockRejectedValueOnce(new Error('boom'))

      await expect(
        pinboardService.importPins(ac, 'user-123', [pinboardPin()])
      ).resolves.toMatchObject({ imported: 0, skipped: 0 })
    })
  })

  describe('exportPins', () => {
    it('leaves private pins out of the export', async () => {
      mockPinService.getUserPins.mockResolvedValue([
        pin({ id: 'a', url: 'https://public.test', isPrivate: false }),
        pin({ id: 'b', url: 'https://secret.test', isPrivate: true }),
      ])

      const exported = await pinboardService.exportPins(ac)

      expect(exported.map(entry => entry.href)).toEqual(['https://public.test'])
    })

    it('maps a pin onto the Pinboard shape', async () => {
      mockPinService.getUserPins.mockResolvedValue([pin()])

      const [entry] = await pinboardService.exportPins(ac)

      expect(entry).toEqual({
        href: 'https://example.com',
        description: 'Example Title',
        extended: 'A description',
        // md5('https://example.com\nExample Title\nA description\ndev tools\nno')
        meta: '0ba5fbea4888d3bb0a3a2d7a2ce27fdb',
        // md5('https://example.com')
        hash: 'c984d06aafbecf6bc55569f964148ea3',
        time: '2024-01-01T00:00:00Z',
        shared: 'no',
        toread: 'no',
        tags: 'dev tools',
      })
    })

    it('writes times without milliseconds', async () => {
      mockPinService.getUserPins.mockResolvedValue([
        pin({ createdAt: new Date('2024-03-04T05:06:07.000Z') }),
      ])

      const [entry] = await pinboardService.exportPins(ac)

      expect(entry.time).toBe('2024-03-04T05:06:07Z')
    })

    it('marks a read-later pin toread and folds that into the meta digest', async () => {
      mockPinService.getUserPins.mockResolvedValue([pin({ readLater: true })])

      const [entry] = await pinboardService.exportPins(ac)

      expect(entry.toread).toBe('yes')
      expect(entry.meta).not.toBe('0ba5fbea4888d3bb0a3a2d7a2ce27fdb')
    })

    it('exports a pin with no description as an empty extended field', async () => {
      mockPinService.getUserPins.mockResolvedValue([
        pin({ description: null, tagNames: [] }),
      ])

      const [entry] = await pinboardService.exportPins(ac)

      expect(entry.extended).toBe('')
      expect(entry.tags).toBe('')
    })

    it('gives two pins with the same URL the same hash', async () => {
      mockPinService.getUserPins.mockResolvedValue([
        pin({ id: 'a', title: 'One' }),
        pin({ id: 'b', title: 'Two' }),
      ])

      const [first, second] = await pinboardService.exportPins(ac)

      expect(first.hash).toBe(second.hash)
      expect(first.meta).not.toBe(second.meta)
    })
  })
})
