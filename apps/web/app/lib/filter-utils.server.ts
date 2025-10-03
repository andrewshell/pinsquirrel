import type { PinFilter } from '@pinsquirrel/domain'

export interface ParsedFilters {
  filter: PinFilter
  currentFilterType: 'all' | 'toread' | 'read'
  activeTag?: string
  viewSettings: {
    sort: 'created' | 'title'
    direction: 'asc' | 'desc'
    size: 'expanded' | 'compact'
  }
}

/**
 * Parses URL search parameters to build consistent filter objects for pin queries
 */
export function parsePinFilters(url: URL): ParsedFilters {
  const tagFilter = url.searchParams.get('tag') || undefined
  const unreadParam = url.searchParams.get('unread')
  const searchParam = url.searchParams.get('search') || undefined
  const noTagsParam = url.searchParams.get('notags')

  // Parse view settings
  const sortParam = url.searchParams.get('sort')
  const directionParam = url.searchParams.get('direction')
  const sizeParam = url.searchParams.get('size')

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

  // Add sort parameters to filter
  if (sortParam === 'created' || sortParam === 'title') {
    filter.sortBy = sortParam
  }
  if (directionParam === 'asc' || directionParam === 'desc') {
    filter.sortDirection = directionParam
  }

  return {
    filter,
    currentFilterType,
    activeTag: tagFilter,
    viewSettings: {
      sort: sortParam === 'title' ? 'title' : 'created',
      direction: directionParam === 'asc' ? 'asc' : 'desc',
      size: sizeParam === 'compact' ? 'compact' : 'expanded',
    },
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

  // Extract filter parameters
  const tag = url.searchParams.get('tag')
  const unread = url.searchParams.get('unread')

  if (tag) {
    params.set('tag', tag)
  }

  if (unread === 'true') {
    params.set('unread', 'true')
  }

  // Extract view settings parameters
  const sort = url.searchParams.get('sort')
  const direction = url.searchParams.get('direction')
  const size = url.searchParams.get('size')

  if (sort === 'created' || sort === 'title') {
    params.set('sort', sort)
  }

  if (direction === 'asc' || direction === 'desc') {
    params.set('direction', direction)
  }

  if (size === 'expanded' || size === 'compact') {
    params.set('size', size)
  }

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}
