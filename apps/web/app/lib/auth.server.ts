import type { User } from '@pinsquirrel/domain'

/**
 * Validates that the username in the URL matches the authenticated user
 * @param user The authenticated user
 * @param usernameParam The username from the URL params
 * @throws Response with 403 status if username doesn't match
 */
export function requireUsernameMatch(user: User, usernameParam: string): void {
  if (user.username !== usernameParam) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw new Response("You don't have access to this user's pins", {
      status: 403,
      statusText: 'Forbidden',
    })
  }
}

/**
 * Creates a user-specific redirect path
 * @param username The username to include in the path
 * @param path The path after the username (e.g., '/pins')
 * @param queryParams Optional query parameters to preserve
 * @returns The full path with username and query parameters
 */
export function getUserPath(
  username: string,
  path: string = '/pins',
  queryParams?: string
): string {
  const basePath = `/${username}${path}`
  return queryParams ? `${basePath}${queryParams}` : basePath
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
