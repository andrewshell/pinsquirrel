import { isValidUrl } from '@pinsquirrel/core'

export interface UrlParams {
  url?: string
  title?: string
  description?: string
}

/**
 * Extracts and sanitizes URL parameters for pin creation
 */
export function extractUrlParams(request: Request): UrlParams | null {
  const url = new URL(request.url)
  const searchParams = url.searchParams

  const rawUrl = searchParams.get('url')
  const rawTitle = searchParams.get('title')
  const rawDescription = searchParams.get('description')

  // If none of the expected parameters are in the URL, return null
  if (
    !searchParams.has('url') &&
    !searchParams.has('title') &&
    !searchParams.has('description')
  ) {
    return null
  }

  return {
    url: sanitizeUrl(rawUrl),
    title: sanitizeText(rawTitle, 500), // Limit title to 500 characters
    description: sanitizeText(rawDescription, 2000), // Limit description to 2000 characters
  }
}

/**
 * Sanitizes and validates URL parameter
 */
function sanitizeUrl(url: string | null): string {
  if (!url) return ''

  // Basic HTML entity decoding for common cases
  const decoded = url
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Validate URL format
  if (!isValidUrl(decoded)) {
    return ''
  }

  return decoded
}

/**
 * Sanitizes text input by removing HTML tags and limiting length
 */
function sanitizeText(text: string | null, maxLength: number): string {
  if (!text) return ''

  // Remove HTML tags using a simple regex (not foolproof but good enough for basic sanitization)
  const withoutTags = text.replace(/<[^>]*>/g, '')

  // Decode common HTML entities
  const decoded = withoutTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // Limit length
  if (decoded.length > maxLength) {
    return decoded.substring(0, maxLength)
  }

  return decoded
}
