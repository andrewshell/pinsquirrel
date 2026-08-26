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
