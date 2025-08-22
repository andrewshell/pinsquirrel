import type { TagWithCount } from '@pinsquirrel/core'
import { Link } from 'react-router'

interface TagCloudProps {
  tags: TagWithCount[]
  username: string
  currentFilter?: 'all' | 'toread'
  untaggedPinsCount?: number
}

const getFontSizeClass = (
  pinCount: number,
  maxCount: number,
  minCount: number
): string => {
  // If all tags have the same count, use medium size
  if (maxCount === minCount) {
    return 'text-lg'
  }

  const sizeClasses = [
    'text-sm', // level 0: smallest
    'text-base', // level 1
    'text-lg', // level 2
    'text-xl', // level 3: medium
    'text-2xl', // level 4
    'text-3xl', // level 5
    'text-4xl', // level 6: largest
  ]

  // Simple bucket approach based on relative position
  const range = maxCount - minCount

  if (range === 0) {
    return sizeClasses[3] // medium
  }

  // Calculate percentage position in range
  const percentage = ((pinCount - minCount) / range) * 100

  // Create buckets with better distribution
  let sizeIndex: number
  if (percentage === 0) {
    sizeIndex = 0 // Smallest for minimum
  } else if (percentage <= 15) {
    sizeIndex = 1
  } else if (percentage <= 30) {
    sizeIndex = 2
  } else if (percentage <= 50) {
    sizeIndex = 3
  } else if (percentage <= 70) {
    sizeIndex = 4
  } else if (percentage <= 85) {
    sizeIndex = 5
  } else {
    sizeIndex = 6 // Largest for top 15%
  }

  return sizeClasses[sizeIndex]
}

const getOpacityClass = (
  pinCount: number,
  maxCount: number,
  minCount: number
): string => {
  if (pinCount === 1) {
    return 'opacity-40'
  }

  if (maxCount === minCount) {
    return 'opacity-100'
  }

  // Normalize the count to a 0-1 range
  const normalized = (pinCount - minCount) / (maxCount - minCount)

  // Map to opacity levels (60% to 100%)
  const opacity = 60 + normalized * 40

  if (opacity >= 95) return 'opacity-100'
  if (opacity >= 85) return 'opacity-90'
  if (opacity >= 75) return 'opacity-80'
  if (opacity >= 65) return 'opacity-70'
  return 'opacity-60'
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
  if (untaggedPinsCount > 0) {
    pinCounts.push(untaggedPinsCount)
  }
  const minCount = Math.min(...pinCounts)
  const maxCount = Math.max(...pinCounts)

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
            const fontSizeClass = getFontSizeClass(
              untaggedPinsCount,
              maxCount,
              minCount
            )
            const opacityClass = getOpacityClass(
              untaggedPinsCount,
              maxCount,
              minCount
            )

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
        const fontSizeClass = getFontSizeClass(tag.pinCount, maxCount, minCount)
        const opacityClass = getOpacityClass(tag.pinCount, maxCount, minCount)

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
