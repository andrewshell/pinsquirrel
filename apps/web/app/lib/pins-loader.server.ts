import { type PinFilter } from '@pinsquirrel/domain'
import { data } from 'react-router'
import { requireUsernameMatch } from '~/lib/auth.server'
import { parsePinFilters } from '~/lib/filter-utils.server'
import { pinService } from '~/lib/services/container.server'
import {
  commitSession,
  getSession,
  requireAccessControl,
} from '~/lib/session.server'

export type ReadFilterType = 'all' | 'toread' | 'read'

export interface PinsLoaderConfig {
  currentFilter: ReadFilterType
  filter: PinFilter
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
  const pageParam = url.searchParams.get('page')
  const pageSizeParam = url.searchParams.get('pageSize')

  const paginationParams = {
    page: pageParam ? Math.max(1, Number(pageParam) || 1) : 1,
    pageSize: pageSizeParam ? Number(pageSizeParam) || undefined : undefined,
  }

  // Parse filter parameters from URL using centralized utility
  const parsedFilters = parsePinFilters(url)

  // Build filter object combining config filter with URL parameters
  const filter: PinFilter = {
    ...config.filter,
    ...parsedFilters.filter,
  }

  // Get access control and validate username match
  const ac = await requireAccessControl(request)
  requireUsernameMatch(ac.user!, params.username)

  // Get session for flash messages
  const session = await getSession(request)

  // Check for flash messages (these are automatically removed when accessed)
  const successMessage = session.get('flash-success') as string | null
  const errorMessage = session.get('flash-error') as string | null

  // Get pins with pagination using the service
  const result = await pinService.getUserPinsWithPagination(
    ac,
    filter,
    paginationParams
  )

  // Return with updated session to clear flash messages
  return data(
    {
      pins: result.pins,
      totalPages: result.pagination.totalPages,
      currentPage: result.pagination.page,
      totalCount: result.totalCount,
      currentFilter:
        parsedFilters.currentFilterType !== 'all'
          ? parsedFilters.currentFilterType
          : config.currentFilter,
      activeTag: parsedFilters.activeTag,
      noTags: filter.noTags || false,
      username: ac.user!.username,
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
