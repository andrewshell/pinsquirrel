import type { Route } from './+types/api.metadata'
import { requireUser } from '~/lib/session.server'
import { metadataService } from '~/lib/services/container.server'
import { HttpMetadataService } from '@pinsquirrel/core'
import { logger } from '~/lib/logger.server'

export async function loader({ request }: Route.LoaderArgs) {
  // Ensure user is authenticated
  await requireUser(request)

  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return Response.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const metadata = await metadataService.fetchMetadata(targetUrl)

    logger.info('Successfully fetched metadata', {
      url: targetUrl,
      hasTitle: !!metadata.title,
      hasDescription: !!metadata.description,
    })

    return Response.json(metadata)
  } catch (error) {
    logger.exception(error, 'Error fetching metadata', {
      url: targetUrl,
    })

    // Use the service's error mapping methods
    const statusCode = HttpMetadataService.getHttpStatusForError(error as Error)
    const message = HttpMetadataService.getUserFriendlyMessage(error as Error)

    return Response.json({ error: message }, { status: statusCode })
  }
}
