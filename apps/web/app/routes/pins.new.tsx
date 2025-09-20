import { redirect } from 'react-router'
import type { Route } from './+types/pins.new'
import { requireAccessControl } from '~/lib/session.server'
import { getUserPath } from '~/lib/auth.server'

/**
 * Web Share Target handler
 *
 * This route handles shares from the Web Share Target API and redirects
 * to the user-specific pin creation page with the shared parameters
 */
export async function loader({ request }: Route.LoaderArgs) {
  // Get access control - this will redirect to signin if not authenticated
  const ac = await requireAccessControl(request)

  // Get the current URL to preserve query parameters
  const url = new URL(request.url)
  const searchParams = url.searchParams.toString()

  // Redirect to user-specific pin creation page with preserved query params
  const redirectTo = getUserPath(
    ac.user!.username,
    '/pins/new',
    searchParams ? `?${searchParams}` : ''
  )

  return redirect(redirectTo)
}

// This route should only handle GET requests for sharing, no page rendering needed
export default function PinsNewRedirect() {
  return null
}
