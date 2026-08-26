import type { TagWithCount } from '../types.ts'

/**
 * The tag list, drawn into an element the caller owns.
 *
 * Built node by node rather than from an HTML string: a tag name is user data,
 * and `innerHTML` would let one containing markup run as markup inside the
 * popup, which is the one page in the extension holding the tokens.
 *
 * Nothing here listens for anything. The wiring puts one `change` listener on
 * the container and picks the box out of the event with `asCheckbox`, so a
 * re-render cannot leave stale listeners behind on discarded nodes.
 *
 * `tags` is what the list shows, not what the account has: with a filter in
 * the box it is the matches. `selectedTagIds` may name tags that are not in
 * `tags` at all - they are simply not drawn, and stay selected.
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
 * The tag box a change event came from, or null if it came from anything else.
 *
 * The one listener sits on the container, so the target is whatever inside it
 * was touched. The caller wants the box that moved rather than a read of every
 * box on screen: the rows are only the tags matching the filter, and the tags
 * it hides are still selected.
 */
export function asCheckbox(
  target: EventTarget | null
): HTMLInputElement | null {
  if (!(target instanceof HTMLInputElement)) return null
  return target.type === 'checkbox' ? target : null
}
