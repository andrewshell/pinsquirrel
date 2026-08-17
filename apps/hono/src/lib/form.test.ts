import { describe, it, expect } from 'vitest'
import { getString, parseTagNames, parsePinForm } from './form'

describe('getString', () => {
  it('returns strings unchanged', () => {
    expect(getString('hello')).toBe('hello')
    expect(getString('')).toBe('')
  })

  it('takes the first entry of a repeated field', () => {
    expect(getString(['a', 'b'])).toBe('a')
  })

  it('recurses into nested arrays', () => {
    expect(getString([['a']])).toBe('a')
  })

  it('returns empty string for a missing or non-string field', () => {
    expect(getString(undefined)).toBe('')
    expect(getString(null)).toBe('')
    expect(getString(42)).toBe('')
    expect(getString([])).toBe('')
    // parseBody yields File objects for uploads; treat them as absent rather
    // than stringifying them into "[object File]".
    expect(getString(new File([], 'x.txt'))).toBe('')
  })
})

describe('parseTagNames', () => {
  it('splits on commas and trims', () => {
    expect(parseTagNames('foo, bar')).toEqual(['foo', 'bar'])
    expect(parseTagNames(' foo , bar ')).toEqual(['foo', 'bar'])
  })

  it('drops empty entries', () => {
    expect(parseTagNames(' foo , , bar ')).toEqual(['foo', 'bar'])
    expect(parseTagNames('')).toEqual([])
    expect(parseTagNames(',,')).toEqual([])
  })

  it('keeps a single tag', () => {
    expect(parseTagNames('foo')).toEqual(['foo'])
  })
})

describe('parsePinForm', () => {
  it('reads every pin field', () => {
    expect(
      parsePinForm({
        url: 'https://x.test/a',
        title: 'Title',
        description: 'Desc',
        readLater: 'true',
        isPrivate: 'true',
        tags: 'foo, bar',
      })
    ).toEqual({
      url: 'https://x.test/a',
      title: 'Title',
      description: 'Desc',
      readLater: true,
      isPrivate: true,
      tagsInput: 'foo, bar',
      tagNames: ['foo', 'bar'],
    })
  })

  it('maps an empty description to null, not empty string', () => {
    expect(parsePinForm({ description: '' }).description).toBeNull()
    expect(parsePinForm({}).description).toBeNull()
  })

  it('treats the booleans as true only for the literal string "true"', () => {
    expect(parsePinForm({ readLater: 'on' }).readLater).toBe(false)
    expect(parsePinForm({ readLater: 'TRUE' }).readLater).toBe(false)
    expect(parsePinForm({ isPrivate: '1' }).isPrivate).toBe(false)
    expect(parsePinForm({ readLater: 'true' }).readLater).toBe(true)
  })

  it('defaults an empty form to blank values rather than throwing', () => {
    expect(parsePinForm({})).toEqual({
      url: '',
      title: '',
      description: null,
      readLater: false,
      isPrivate: false,
      tagsInput: '',
      tagNames: [],
    })
  })
})
