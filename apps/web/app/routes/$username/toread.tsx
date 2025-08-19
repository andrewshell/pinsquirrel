import { useLoaderData } from 'react-router'
import { PinsPageLayout } from '~/components/pins/PinsPageLayout'
import type { Route } from './+types/toread'

export function meta({ params }: Route.MetaArgs) {
  return [
    {
      title: `${params.username}'s To Read Pins - PinSquirrel`,
    },
    {
      name: 'description',
      content:
        'Browse your "to read" bookmarks and articles saved for later on PinSquirrel.',
    },
  ]
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { createPinsLoader } = await import('~/lib/pins-loader.server')
  const config = {
    currentFilter: 'toread',
    filter: { readLater: true },
    title: `{username}'s To Read Pins - PinSquirrel`,
    description:
      'Browse your "to read" bookmarks and articles saved for later on PinSquirrel.',
  }
  return createPinsLoader(request, params, config)
}

export default function PinsToReadPage() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <PinsPageLayout
      {...loaderData}
      createPinPath={`/${loaderData.username}/pins/new`}
    />
  )
}
