import type { TagWithCount } from '@pinsquirrel/domain'
import { BaseLayout } from '../layouts/base'
import { FlashMessage as FlashMessageComponent } from '../components/FlashMessage'
import type { FlashMessage } from '../../middleware/session'

export type TagFilterType = 'all' | 'toread'

interface TagsPageProps {
  tags: TagWithCount[]
  currentFilter: TagFilterType
  untaggedPinsCount: number
  flash?: FlashMessage | null
}

function getFontSizeClass(pinCount: number, pinCounts: number[]): string {
  const sizeClasses = [
    'text-sm', // level 0: smallest
    'text-base', // level 1
    'text-lg', // level 2
    'text-xl', // level 3: medium
    'text-2xl', // level 4
    'text-3xl', // level 5
    'text-4xl', // level 6: largest
  ]

  const pinCountsCopy = [...new Set(pinCounts)].sort((a, b) => a - b)

  if (pinCountsCopy.length < sizeClasses.length) {
    return 'text-base'
  }

  const sizeStep = Math.floor(pinCountsCopy.length / sizeClasses.length)
  const sizeMin = []
  for (let i = 0; i < sizeClasses.length; i++) {
    sizeMin[i] = pinCountsCopy[sizeStep * i]
  }

  const i = sizeMin.findIndex((size) => size > pinCount)
  if (i === -1) {
    return sizeClasses[sizeClasses.length - 1]
  } else {
    return sizeClasses[i - 1]
  }
}

function getOpacityClass(pinCount: number): string {
  if (pinCount === 1) {
    return 'opacity-50'
  }

  if (pinCount <= 5) {
    return 'opacity-75'
  }

  return 'opacity-100'
}

function buildTagUrl(tagName: string, currentFilter: TagFilterType): string {
  const params = new URLSearchParams()
  params.set('tag', tagName)
  if (currentFilter === 'toread') {
    params.set('unread', 'true')
  }
  return `/pins?${params.toString()}`
}

function buildUntaggedUrl(currentFilter: TagFilterType): string {
  const params = new URLSearchParams()
  params.set('notags', 'true')
  if (currentFilter === 'toread') {
    params.set('unread', 'true')
  }
  return `/pins?${params.toString()}`
}

export function TagsPage({
  tags,
  currentFilter,
  untaggedPinsCount,
  flash,
}: TagsPageProps) {
  // Sort tags alphabetically by name
  const sortedTags = [...tags].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  // Get all pin counts for sizing calculation
  const pinCounts = tags.map((tag) => tag.pinCount)

  return (
    <BaseLayout title="Tags">
      <div class="container mx-auto px-4 py-8 max-w-4xl">
        {/* Flash message */}
        {flash && (
          <FlashMessageComponent
            type={flash.type}
            message={flash.message}
            className="mb-6"
          />
        )}

        {/* Header with filter and merge button */}
        <div
          class="mb-8 flex flex-col gap-4
                    sm:flex-row sm:justify-between sm:items-center"
        >
          {/* Filter buttons */}
          <div class="flex gap-2">
            <a
              href="/tags"
              class={`px-4 py-2 font-medium border-2 border-foreground transition-all
                ${
                  currentFilter === 'all'
                    ? 'bg-primary text-primary-foreground neobrutalism-shadow'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              All
            </a>
            <a
              href="/tags?unread=true"
              class={`px-4 py-2 font-medium border-2 border-foreground transition-all
                ${
                  currentFilter === 'toread'
                    ? 'bg-primary text-primary-foreground neobrutalism-shadow'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              To Read
            </a>
          </div>

          {/* Merge button - only show if more than 1 tag */}
          {tags.length > 1 && (
            <a
              href="/tags/merge"
              class="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-medium border-2 border-foreground neobrutalism-shadow
                     hover:neobrutalism-shadow-hover hover:translate-x-[-2px] hover:translate-y-[-2px]
                     active:neobrutalism-shadow-pressed active:translate-x-[2px] active:translate-y-[2px]
                     transition-all"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="m8 6 4-4 4 4" />
                <path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22" />
                <path d="m20 22-5-5" />
              </svg>
              Merge Tags
            </a>
          )}
        </div>

        {/* Page title */}
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-foreground mb-2">Tags</h1>
          <p class="text-muted-foreground">
            {tags.length === 0
              ? 'No tags yet. Tags will appear here when you add them to your pins.'
              : `${tags.length} tag${tags.length === 1 ? '' : 's'} total`}
          </p>
        </div>

        {/* Tag cloud or empty state */}
        {tags.length > 0 || untaggedPinsCount > 0 ? (
          <div class="flex flex-wrap gap-3 items-center justify-start">
            {/* Untagged pins link - shown first in italics */}
            {untaggedPinsCount > 0 && (
              <a
                href={buildUntaggedUrl(currentFilter)}
                class={`${getFontSizeClass(untaggedPinsCount, pinCounts)} ${getOpacityClass(untaggedPinsCount)} text-accent hover:text-accent/80 hover:underline transition-all duration-200 font-medium italic`}
                title={`Untagged pins (${untaggedPinsCount} pin${untaggedPinsCount === 1 ? '' : 's'})`}
                aria-label={`View untagged pins (${untaggedPinsCount} pin${untaggedPinsCount === 1 ? '' : 's'})`}
              >
                Untagged
              </a>
            )}

            {/* Tag links */}
            {sortedTags.map((tag) => {
              const fontSizeClass = getFontSizeClass(tag.pinCount, pinCounts)
              const opacityClass = getOpacityClass(tag.pinCount)
              const tagUrl = buildTagUrl(tag.name, currentFilter)

              return (
                <a
                  key={tag.id}
                  href={tagUrl}
                  class={`${fontSizeClass} ${opacityClass} text-accent hover:text-accent/80 hover:underline transition-all duration-200 font-medium`}
                  title={`${tag.name} (${tag.pinCount} pin${tag.pinCount === 1 ? '' : 's'})`}
                  aria-label={`View pins tagged with ${tag.name} (${tag.pinCount} pin${tag.pinCount === 1 ? '' : 's'})`}
                >
                  {tag.name}
                </a>
              )
            })}
          </div>
        ) : (
          <div class="text-center py-12">
            <p class="text-muted-foreground mb-4">
              You haven't created any tags yet.
            </p>
            <p class="text-sm text-muted-foreground">
              Tags help organize your pins. Add some tags to your pins to see
              them here!
            </p>
          </div>
        )}
      </div>
    </BaseLayout>
  )
}
