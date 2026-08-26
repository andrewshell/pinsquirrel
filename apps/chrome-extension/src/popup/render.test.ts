// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import type { TagWithCount } from '../types.ts'
import { asCheckbox, renderTagList } from './render.ts'

function tag(id: string, name: string, pinCount: number): TagWithCount {
  return {
    id,
    userId: 'user-1',
    name,
    pinCount,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

/** What the caller says when the list has nothing to draw. */
const EMPTY = 'No tags yet.'

let container: HTMLElement

beforeEach(() => {
  document.body.innerHTML = '<div id="tag-list"></div>'
  container = document.querySelector<HTMLElement>('#tag-list')!
})

function checkboxes(): HTMLInputElement[] {
  return [
    ...container.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
  ]
}

describe('renderTagList', () => {
  it('gives every tag a checkbox carrying its id, name and pin count', () => {
    renderTagList(
      container,
      [tag('t1', 'reading', 12), tag('t2', 'rust', 3)],
      [],
      EMPTY
    )

    expect(checkboxes().map(input => input.value)).toEqual(['t1', 't2'])
    expect(container.textContent).toContain('reading')
    expect(container.textContent).toContain('12')
    expect(container.textContent).toContain('rust')
  })

  it('checks the tags the user has already selected', () => {
    renderTagList(
      container,
      [tag('t1', 'reading', 12), tag('t2', 'rust', 3)],
      ['t2'],
      EMPTY
    )

    expect(checkboxes().map(input => input.checked)).toEqual([false, true])
  })

  it('replaces the previous list rather than appending to it', () => {
    renderTagList(container, [tag('t1', 'reading', 12)], [], EMPTY)
    renderTagList(container, [tag('t2', 'rust', 3)], [], EMPTY)

    expect(checkboxes().map(input => input.value)).toEqual(['t2'])
  })

  it('says there is nothing to select when the account has no tags', () => {
    renderTagList(container, [], [], EMPTY)

    expect(checkboxes()).toHaveLength(0)
    expect(container.textContent).toBe(EMPTY)
  })

  it('says whatever the caller gives it when there is nothing to draw', () => {
    renderTagList(container, [], ['t1'], 'No tags match "zzz".')

    expect(checkboxes()).toHaveLength(0)
    expect(container.textContent).toBe('No tags match "zzz".')
  })

  it('shows a tag name as text, never as markup', () => {
    renderTagList(
      container,
      [tag('t1', '<img src=x onerror=boom>', 1)],
      [],
      EMPTY
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=boom>')
  })
})

describe('asCheckbox', () => {
  it('answers with the box a change event came from', () => {
    renderTagList(container, [tag('t1', 'reading', 12)], [], EMPTY)
    const box = checkboxes()[0]

    expect(asCheckbox(box)).toBe(box)
    expect(asCheckbox(box)?.value).toBe('t1')
  })

  it('answers null for anything in the list that is not a box', () => {
    renderTagList(container, [tag('t1', 'reading', 12)], [], EMPTY)

    expect(asCheckbox(container.querySelector('.tag-name'))).toBeNull()
    expect(asCheckbox(container)).toBeNull()
    expect(asCheckbox(null)).toBeNull()
  })
})
