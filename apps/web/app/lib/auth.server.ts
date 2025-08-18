import type { User } from '@pinsquirrel/core'

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
 * @returns The full path with username
 */
export function getUserPath(username: string, path: string = '/pins'): string {
  return `/${username}${path}`
}
