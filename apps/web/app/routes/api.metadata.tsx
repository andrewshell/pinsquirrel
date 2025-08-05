import type { Route } from './+types/api.metadata'
import { requireUser } from '~/lib/session.server'
import { HttpMetadataService, CheerioHtmlParser, NodeHttpFetcher } from '@pinsquirrel/core'
import { logger } from '~/lib/logger.server'

// Create service instances
const htmlParser = new CheerioHtmlParser()
const httpFetcher = new NodeHttpFetcher()
const metadataService = new HttpMetadataService(httpFetcher, htmlParser)

export async function loader({ request }: Route.LoaderArgs) {
  // Ensure user is authenticated
  await requireUser(request)

  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return Response.json(
      { error: 'Missing url parameter' },
      { status: 400 }
    )
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

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Map different error types to appropriate HTTP status codes
    if (errorMessage.includes('Invalid URL protocol') || errorMessage.includes('Invalid URL format')) {
      return Response.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    if (errorMessage.includes('TimeoutError') || errorMessage.includes('timeout')) {
      return Response.json(
        { error: 'Request timeout' },
        { status: 408 }
      )
    }

    if (errorMessage.includes('HTTP 404') || errorMessage.includes('Not Found')) {
      return Response.json(
        { error: 'Failed to fetch URL content' },
        { status: 404 }
      )
    }

    return Response.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    )
  }
}