/**
 * Which tags the list shows, worked out without touching the DOM.
 *
 * Pure like `format.ts` and for the same reason: an account with hundreds of
 * tags makes the list unusable without a filter, and what "matches" means is
 * worth reading as a spec rather than picking out of a render loop.
 */
import type { TagWithCount } from '../types.ts'

/**
 * The tags whose name contains `query`, in the order they were given.
 *
 * Case-insensitive substring, not a prefix: tags read like `trust-and-safety`,
 * where the word the user remembers is rarely the first one. An empty or
 * blank query matches everything, so clearing the box is what shows the lot.
 */
export function filterTags(
  tags: TagWithCount[],
  query: string
): TagWithCount[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return tags
  return tags.filter(tag => tag.name.toLowerCase().includes(needle))
}

/**
 * The tags that are selected, in the order they were given.
 *
 * Takes the selection rather than reading the boxes for the same reason the
 * wiring holds it: the rows on screen are only what the text filter matched,
 * and a selected tag it is hiding is still selected. Ids naming no tag in
 * `tags` are simply not in the answer, so this composes with `filterTags` -
 * hand it the matches and it narrows them to the picked ones.
 */
export function filterSelected(
  tags: TagWithCount[],
  selectedTagIds: ReadonlySet<string>
): TagWithCount[] {
  return tags.filter(tag => selectedTagIds.has(tag.id))
}
