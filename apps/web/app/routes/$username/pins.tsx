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
  const { parsePinFilters } = await import('~/lib/filter-utils.server')

  const url = new URL(request.url)
  const parsedFilters = parsePinFilters(url)

  const config = {
    currentFilter: 'all' as const,
    filter: {},
    title: `{username}'s Pins - PinSquirrel`,
    description:
      'Browse and manage your saved links, articles, and bookmarks on PinSquirrel.',
  }
  const loaderData = await createPinsLoader(request, params, config)

  return data(
    {
      ...loaderData.data,
      searchParamsString: url.search,
      viewSettings: parsedFilters.viewSettings,
    },
    loaderData.init || undefined
  )
}

export default function PinsPage() {
  const loaderData = useLoaderData<typeof loader>()

  // Convert search params string back to URLSearchParams object
  const searchParams = new URLSearchParams(loaderData.searchParamsString || '')

  return (
    <PinsPageLayout
      pinsData={loaderData.pinsData}
      username={loaderData.username}
      successMessage={loaderData.successMessage}
      errorMessage={loaderData.errorMessage}
      activeTag={loaderData.activeTag}
      currentFilter={loaderData.currentFilter}
      noTags={loaderData.noTags}
      searchParams={searchParams}
      viewSettings={loaderData.viewSettings}
    />
  )
}
