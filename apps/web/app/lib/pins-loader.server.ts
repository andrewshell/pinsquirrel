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

  // Create promise for pins data (non-critical, can be streamed)
  const pinsPromise = pinService.getUserPinsWithPagination(
    ac,
    filter,
    paginationParams
  )

  // Return with updated session to clear flash messages
  return data(
    {
      // Critical data (available immediately)
      currentFilter:
        parsedFilters.currentFilterType !== 'all'
          ? parsedFilters.currentFilterType
          : config.currentFilter,
      activeTag: parsedFilters.activeTag,
      noTags: filter.noTags || false,
      username: ac.user!.username,
      successMessage,
      errorMessage,
      // Non-critical data (promise to be resolved with Suspense)
      pinsData: pinsPromise,
    },
    {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    }
  )
}
