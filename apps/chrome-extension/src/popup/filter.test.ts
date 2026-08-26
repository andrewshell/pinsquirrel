import { describe, expect, it } from 'vitest'
import type { TagWithCount } from '../types.ts'
import { filterSelected, filterTags } from './filter.ts'

function tag(id: string, name: string): TagWithCount {
  return {
    id,
    userId: 'user-1',
    name,
    pinCount: 1,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

const TAGS = [
  tag('t1', 'reading'),
  tag('t2', 'Rust'),
  tag('t3', 'trust-and-safety'),
]

describe('filterTags', () => {
  it('keeps every tag when nothing has been typed', () => {
    expect(filterTags(TAGS, '')).toEqual(TAGS)
  })

  it('keeps every tag when the box holds only spaces', () => {
    expect(filterTags(TAGS, '   ')).toEqual(TAGS)
  })

  it('keeps the tags whose name contains the query, in the order given', () => {
    expect(filterTags(TAGS, 'us').map(match => match.id)).toEqual(['t2', 't3'])
  })

  it('ignores case on both sides', () => {
    // `Rust` is stored capitalised and `trust-and-safety` is not: both match.
    expect(filterTags(TAGS, 'RUST').map(match => match.id)).toEqual([
      't2',
      't3',
    ])
    expect(filterTags(TAGS, 'rEaD').map(match => match.id)).toEqual(['t1'])
  })

  it('matches anywhere in the name, not just at the start', () => {
    expect(filterTags(TAGS, 'safety').map(match => match.id)).toEqual(['t3'])
  })

  it('ignores the spaces around what was typed', () => {
    expect(filterTags(TAGS, '  read  ').map(match => match.id)).toEqual(['t1'])
  })

  it('answers with nothing when no name contains the query', () => {
    expect(filterTags(TAGS, 'zzz')).toEqual([])
  })
})

describe('filterSelected', () => {
  it('keeps only the tags whose id is selected, in the order given', () => {
    expect(
      filterSelected(TAGS, new Set(['t3', 't1'])).map(match => match.id)
    ).toEqual(['t1', 't3'])
  })

  it('answers with nothing when nothing is selected', () => {
    expect(filterSelected(TAGS, new Set())).toEqual([])
  })

  it('ignores a selected id the account no longer has a tag for', () => {
    expect(
      filterSelected(TAGS, new Set(['t2', 'gone'])).map(match => match.id)
    ).toEqual(['t2'])
  })

  it('composes with the text filter, both narrowing the list', () => {
    expect(
      filterSelected(filterTags(TAGS, 'us'), new Set(['t2', 't1'])).map(
        match => match.id
      )
    ).toEqual(['t2'])
  })
})
