import type { Route } from './+types/logout'
import { logout } from '~/lib/session.server'

export async function action({ request }: Route.ActionArgs) {
  return await logout(request)
}

export async function loader({ request }: Route.LoaderArgs) {
  return await logout(request)
}
