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
    currentFilter: 'all' as const,
    filter: {},
    title: `{username}'s Pins - PinSquirrel`,
    description:
      'Browse and manage your saved links, articles, and bookmarks on PinSquirrel.',
  }
  const loaderData = await createPinsLoader(request, params, config)

  const url = new URL(request.url)

  return data(
    {
      ...loaderData.data,
      searchParamsString: url.search,
    },
    loaderData.init || undefined
  )
}

export default function PinsPage() {
  const loaderData = useLoaderData<typeof loader>()

  // Convert search params string back to URLSearchParams object
  const searchParams = new URLSearchParams(loaderData.searchParamsString || '')

  return <PinsPageLayout {...loaderData} searchParams={searchParams} />
}
