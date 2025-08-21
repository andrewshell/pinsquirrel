import type { PinFilter } from '@pinsquirrel/core'

export interface ParsedFilters {
  filter: PinFilter
  currentFilterType: 'all' | 'toread' | 'read'
  activeTag?: string
}

/**
 * Parses URL search parameters to build consistent filter objects for pin queries
 */
export function parsePinFilters(url: URL): ParsedFilters {
  const tagFilter = url.searchParams.get('tag') || undefined
  const unreadParam = url.searchParams.get('unread')
  const searchParam = url.searchParams.get('search') || undefined

  const filter: PinFilter = {}
  let currentFilterType: 'all' | 'toread' | 'read' = 'all'

  // Add tag filter if present
  if (tagFilter) {
    filter.tag = tagFilter
  }

  // Add search filter if present
  if (searchParam) {
    filter.search = searchParam
  }

  // Handle unread parameter logic:
  // - unread=true: show only read_later pins
  // - unread=false: show only non-read_later pins
  // - no unread param: show both
  if (unreadParam === 'true') {
    filter.readLater = true
    currentFilterType = 'toread'
  } else if (unreadParam === 'false') {
    filter.readLater = false
    currentFilterType = 'read'
  }

  return {
    filter,
    currentFilterType,
    activeTag: tagFilter,
  }
}
