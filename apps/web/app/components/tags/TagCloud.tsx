import type { TagWithCount } from '@pinsquirrel/domain'
import { Link } from 'react-router'

interface TagCloudProps {
  tags: TagWithCount[]
  username: string
  currentFilter?: 'all' | 'toread'
  untaggedPinsCount?: number
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

  const i = sizeMin.findIndex(size => size > pinCount)
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

export function TagCloud({
  tags,
  username,
  currentFilter = 'all',
  untaggedPinsCount = 0,
}: TagCloudProps) {
  if (tags.length === 0 && untaggedPinsCount === 0) {
    return null
  }

  // Calculate min and max pin counts for scaling (including untagged count)
  const pinCounts = tags.map(tag => tag.pinCount)

  // Sort tags alphabetically by name
  const sortedTags = [...tags].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  return (
    <div className="flex flex-wrap gap-3 items-center justify-start">
      {/* Untagged pins link - shown first and in italics */}
      {untaggedPinsCount > 0 && (
        <>
          {(() => {
            const fontSizeClass = getFontSizeClass(untaggedPinsCount, pinCounts)
            const opacityClass = getOpacityClass(untaggedPinsCount)

            // Build URL for untagged pins and preserve current filter if it's not 'all'
            const params = new URLSearchParams()
            params.set('notags', 'true')
            if (currentFilter === 'toread') {
              params.set('unread', 'true')
            }
            const untaggedUrl = `/${username}/pins?${params.toString()}`

            return (
              <Link
                to={untaggedUrl}
                className={`${fontSizeClass} ${opacityClass} text-accent hover:text-accent/80 hover:underline transition-all duration-200 font-medium italic`}
                title={`Untagged pins (${untaggedPinsCount} pin${untaggedPinsCount === 1 ? '' : 's'})`}
                aria-label={`View untagged pins (${untaggedPinsCount} pin${untaggedPinsCount === 1 ? '' : 's'})`}
              >
                Untagged
              </Link>
            )
          })()}
        </>
      )}
      {sortedTags.map(tag => {
        const fontSizeClass = getFontSizeClass(tag.pinCount, pinCounts)
        const opacityClass = getOpacityClass(tag.pinCount)

        // Build URL with tag and preserve current filter if it's not 'all'
        const params = new URLSearchParams()
        params.set('tag', tag.name)
        if (currentFilter === 'toread') {
          params.set('unread', 'true')
        }
        const tagUrl = `/${username}/pins?${params.toString()}`

        return (
          <Link
            key={tag.id}
            to={tagUrl}
            className={`${fontSizeClass} ${opacityClass} text-accent hover:text-accent/80 hover:underline transition-all duration-200 font-medium`}
            title={`${tag.name} (${tag.pinCount} pin${tag.pinCount === 1 ? '' : 's'})`}
            aria-label={`View pins tagged with ${tag.name} (${tag.pinCount} pin${tag.pinCount === 1 ? '' : 's'})`}
          >
            {tag.name}
          </Link>
        )
      })}
    </div>
  )
}
