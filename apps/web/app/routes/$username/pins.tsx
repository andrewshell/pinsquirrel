import { useLoaderData } from 'react-router'
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
  return createPinsLoader(request, params, config)
}

export default function PinsPage() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <PinsPageLayout
      {...loaderData}
      createPinPath={`/${loaderData.username}/pins/new`}
    />
  )
}
