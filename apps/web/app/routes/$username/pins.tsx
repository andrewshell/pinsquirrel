import { useLoaderData, data } from 'react-router'
import { PinsPageLayout } from '~/components/pins/PinsPageLayout'
import type { Route } from './+types/pins'

export function meta({ params }: Route.MetaArgs) {
  return [
    {
      title: `${params.username}'s Pins - PinSquirrel`,
    },
    {
      name: 'description',
      content:
        'Browse and manage your saved links, articles, and bookmarks on PinSquirrel.',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { createPinsLoader } = await import('~/lib/pins-loader.server')
  const config = {
    currentFilter: 'all',
    filter: {},
    title: `{username}'s Pins - PinSquirrel`,
    description:
      'Browse and manage your saved links, articles, and bookmarks on PinSquirrel.',
  }
  const loaderData = await createPinsLoader(request, params, config)

  // Build createPinPath with current query parameters
  const url = new URL(request.url)
  const queryString = url.search
  const createPinPath = `/${params.username}/pins/new${queryString}`

  return data(
    {
      ...loaderData.data,
      createPinPath,
    },
    loaderData.init || undefined
  )
}

export default function PinsPage() {
  const loaderData = useLoaderData<typeof loader>()

  return <PinsPageLayout {...loaderData} />
}
