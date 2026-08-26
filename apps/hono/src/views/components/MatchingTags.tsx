import type { FC } from 'hono/jsx'

interface MatchingTagsProps {
  /** Tags whose name matched the current search. Empty renders nothing. */
  tags: string[]
  /** The current query string, so a chip keeps the view and read filters. */
  searchParams: string
  baseUrl: string
}

/**
 * Build the tag-filter URL for a matched tag.
 *
 * The search is deliberately dropped rather than combined: the row exists
 * because the user typed a word that turned out to be a tag, and the tag is the
 * broader, more useful answer. Keeping `?search=` as well would AND the two and
 * hand back a shorter list than the one already on screen. Everything else the
 * user set — the view size, the read filter — travels with the click, as it
 * does from a tag on a card; only the page resets, since the list changes.
 */
function buildTagUrl(
  tagName: string,
  currentParams: string,
  baseUrl: string
): string {
  const params = new URLSearchParams(currentParams)
  params.set('tag', tagName)
  params.delete('search')
  params.delete('page')
  return `${baseUrl}?${params.toString()}`
}

/**
 * The "Matching tags" row above a searched pin list.
 *
 * Lives in the content partial rather than the page, because the search box
 * swaps `#pins-content` without a navigation — a row rendered only by the full
 * page would disappear on the first search.
 */
export const MatchingTags: FC<MatchingTagsProps> = ({
  tags,
  searchParams,
  baseUrl,
}) => {
  if (tags.length === 0) {
    return null
  }

  return (
    <div class="mb-6">
      <h2 class="block text-sm font-bold text-foreground uppercase mb-2">
        Matching tags
      </h2>
      <div class="border-4 border-foreground bg-input p-3">
        <div class="flex items-center gap-2 flex-wrap">
          {tags.map(tagName => {
            const url = buildTagUrl(tagName, searchParams, baseUrl)
            return (
              <a
                key={tagName}
                href={url}
                hx-get={url}
                hx-target="#pins-content"
                hx-swap="innerHTML"
                hx-push-url={url}
                class="inline-flex items-center bg-secondary text-secondary-foreground px-2 py-1 text-sm font-medium border-2 border-foreground hover:bg-secondary/80 transition-colors"
              >
                {tagName}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
