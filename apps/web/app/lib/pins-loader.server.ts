import { calculatePagination, parsePaginationParams } from '@pinsquirrel/core'
import { data } from 'react-router'
import { repositories } from '~/lib/services/container.server'
import { commitSession, getSession, requireUser } from '~/lib/session.server'
import { requireUsernameMatch } from '~/lib/auth.server'

export interface PinsLoaderConfig {
  currentFilter: string
  filter: { readLater?: boolean; [key: string]: unknown }
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

  // Get authenticated user and validate username match
  const user = await requireUser(request)
  requireUsernameMatch(user, params.username)

  // Get session for flash messages
  const session = await getSession(request)

  // Check for flash messages (these are automatically removed when accessed)
  const successMessage = session.get('flash-success') as string | null
  const errorMessage = session.get('flash-error') as string | null

  // Get total count for pagination calculation
  const totalCount = await repositories.pin.countByUserIdWithFilter(
    user.id,
    config.filter
  )

  // Calculate pagination details
  const pagination = calculatePagination(totalCount, {
    ...paginationParams,
    defaultPageSize: 25,
    maxPageSize: 100,
  })

  // Fetch pins with pagination
  const pins = await repositories.pin.findByUserIdWithFilter(
    user.id,
    config.filter,
    {
      limit: pagination.pageSize,
      offset: pagination.offset,
    }
  )

  // Return with updated session to clear flash messages
  return data(
    {
      pins,
      totalPages: pagination.totalPages,
      currentPage: pagination.page,
      totalCount,
      currentFilter: config.currentFilter,
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

