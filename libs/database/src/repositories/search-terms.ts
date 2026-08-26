/**
 * The pieces of a free-text search that pins and tags both need.
 *
 * Pin search and tag search have to agree on what a term is and on how a term
 * becomes a LIKE pattern: if they split or escape differently, the same query
 * produces a "Matching tags" row that disagrees with the pin list below it.
 */

/**
 * Split a search query into terms on whitespace.
 *
 * A query of only whitespace yields no terms, which every caller reads as "no
 * search" rather than "match nothing".
 */
export function splitSearchTerms(search: string): string[] {
  return search.split(/\s+/).filter(term => term !== '')
}

/**
 * Escape the characters MySQL's LIKE treats as wildcards.
 *
 * A user searching for `a_c` means those three characters, not "a, anything,
 * c" — and `100%` should not match every pin containing "100". The backslash
 * goes first so the escapes we add are not themselves re-escaped.
 */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&')
}
