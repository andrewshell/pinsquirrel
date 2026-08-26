// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import type { TagWithCount } from '../types.ts'
import { renderTagList, selectedTagIdsIn } from './render.ts'

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
      []
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
      ['t2']
    )

    expect(checkboxes().map(input => input.checked)).toEqual([false, true])
  })

  it('replaces the previous list rather than appending to it', () => {
    renderTagList(container, [tag('t1', 'reading', 12)], [])
    renderTagList(container, [tag('t2', 'rust', 3)], [])

    expect(checkboxes().map(input => input.value)).toEqual(['t2'])
  })

  it('says there is nothing to select when the account has no tags', () => {
    renderTagList(container, [], [])

    expect(checkboxes()).toHaveLength(0)
    expect(container.textContent).toContain('No tags')
  })

  it('shows a tag name as text, never as markup', () => {
    renderTagList(container, [tag('t1', '<img src=x onerror=boom>', 1)], [])

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=boom>')
  })
})

describe('selectedTagIdsIn', () => {
  it('reads back the ids whose boxes are ticked, in the rendered order', () => {
    renderTagList(
      container,
      [tag('t1', 'reading', 12), tag('t2', 'rust', 3), tag('t3', 'ai', 7)],
      ['t1', 't3']
    )

    expect(selectedTagIdsIn(container)).toEqual(['t1', 't3'])
  })

  it('follows a box the user just unticked', () => {
    renderTagList(container, [tag('t1', 'reading', 12)], ['t1'])
    checkboxes()[0].checked = false

    expect(selectedTagIdsIn(container)).toEqual([])
  })
})
