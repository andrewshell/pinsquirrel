import { calculatePagination, parsePaginationParams, type PinFilter as CorePinFilter } from '@pinsquirrel/core'
import { data } from 'react-router'
import { repositories } from '~/lib/services/container.server'
import { commitSession, getSession, requireUser } from '~/lib/session.server'
import { requireUsernameMatch } from '~/lib/auth.server'
import { parsePinFilters } from '~/lib/filter-utils.server'

export interface PinsLoaderConfig {
  currentFilter: string
  filter: CorePinFilter
  title: string
  description: string
}

export async function createPinsLoader(
  request: Request,
  params: { username: string },
  config: PinsLoaderConfig
) {
  const url = new URL(request.url)

  // Parse pagination parameters from URL
  const paginationParams = parsePaginationParams({
    page: url.searchParams.get('page') || undefined,
    pageSize: url.searchParams.get('pageSize') || undefined,
  })

  // Parse filter parameters from URL using centralized utility
  const parsedFilters = parsePinFilters(url)

  // Build filter object combining config filter with URL parameters
  const filter: CorePinFilter = {
    ...config.filter,
    ...parsedFilters.filter,
  }

  // Get authenticated user and validate username match
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Get session for flash messages
  const session = await getSession(request)

  // Check for flash messages (these are automatically removed when accessed)
  const successMessage = session.get('flash-success') as string | null
  const errorMessage = session.get('flash-error') as string | null

  // Get total count for pagination calculation
  const totalCount = await repositories.pin.countByUserId(
    user.id,
    filter
  )

  // Calculate pagination details
  const pagination = calculatePagination(totalCount, {
    ...paginationParams,
    defaultPageSize: 25,
    maxPageSize: 100,
  })

  // Fetch pins with pagination
  const pins = await repositories.pin.findByUserId(user.id, filter, {
    limit: pagination.pageSize,
    offset: pagination.offset,
  })

  // Return with updated session to clear flash messages
  return data(
    {
      pins,
      totalPages: pagination.totalPages,
      currentPage: pagination.page,
      totalCount,
      currentFilter:
        parsedFilters.currentFilterType !== 'all'
          ? parsedFilters.currentFilterType
          : config.currentFilter,
      activeTag: parsedFilters.activeTag,
      username: user.username,
      successMessage,
      errorMessage,
    },
    {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    }
  )
}
