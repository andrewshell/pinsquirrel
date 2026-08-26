import type { TagWithCount } from '../types.ts'

/**
 * The tag list, drawn into an element the caller owns.
 *
 * Built node by node rather than from an HTML string: a tag name is user data,
 * and `innerHTML` would let one containing markup run as markup inside the
 * popup, which is the one page in the extension holding the tokens.
 *
 * Nothing here listens for anything. The wiring puts one `change` listener on
 * the container and reads the boxes back with `selectedTagIdsIn`, so a
 * re-render cannot leave stale listeners behind on discarded nodes.
 */
export function renderTagList(
  container: HTMLElement,
  tags: TagWithCount[],
  selectedTagIds: string[]
): void {
  const doc = container.ownerDocument
  container.replaceChildren()

  if (tags.length === 0) {
    const empty = doc.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'No tags yet. Add tags to your pins on PinSquirrel.'
    container.append(empty)
    return
  }

  const selected = new Set(selectedTagIds)

  for (const tag of tags) {
    const label = doc.createElement('label')
    label.className = 'tag'

    const checkbox = doc.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = tag.id
    checkbox.checked = selected.has(tag.id)

    const name = doc.createElement('span')
    name.className = 'tag-name'
    name.textContent = tag.name

    const count = doc.createElement('span')
    count.className = 'tag-count'
    count.textContent = String(tag.pinCount)

    label.append(checkbox, name, count)
    container.append(label)
  }
}

/**
 * The ids of the ticked boxes, in the order they are drawn.
 *
 * The DOM is the state: the alternative is a parallel array kept in step with
 * it by hand, and the two drift the first time a re-render happens between a
 * click and a read.
 */
export function selectedTagIdsIn(container: HTMLElement): string[] {
  return [
    ...container.querySelectorAll<HTMLInputElement>('input[type=checkbox]'),
  ]
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.value)
}
