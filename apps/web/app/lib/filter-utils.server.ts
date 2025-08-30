import type { PinFilter } from '@pinsquirrel/domain'

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
  const noTagsParam = url.searchParams.get('notags')

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

  // Add noTags filter if present
  if (noTagsParam === 'true') {
    filter.noTags = true
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

/**
 * Extracts filter-related query parameters to preserve state across redirects
 * @param request The request containing URL with query parameters
 * @returns Query string with filter parameters or empty string
 */
export function extractFilterParams(request: Request): string {
  const url = new URL(request.url)
  const params = new URLSearchParams()

  // Extract only the filter parameters we want to preserve
  const tag = url.searchParams.get('tag')
  const unread = url.searchParams.get('unread')

  if (tag) {
    params.set('tag', tag)
  }

  if (unread === 'true') {
    params.set('unread', 'true')
  }

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}
