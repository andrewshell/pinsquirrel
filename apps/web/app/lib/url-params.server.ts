export interface UrlParams {
  url?: string
  title?: string
  description?: string
  tag?: string
  unread?: boolean
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
  const rawTag = searchParams.get('tag')
  const rawUnread = searchParams.get('unread')

  // If none of the expected parameters are in the URL, return null
  if (
    !searchParams.has('url') &&
    !searchParams.has('title') &&
    !searchParams.has('description') &&
    !searchParams.has('tag') &&
    !searchParams.has('unread')
  ) {
    return null
  }

  return {
    url: sanitizeUrl(rawUrl),
    title: sanitizeText(rawTitle, 500), // Limit title to 500 characters
    description: sanitizeText(rawDescription, 2000), // Limit description to 2000 characters
    tag: sanitizeText(rawTag, 100), // Limit tag to 100 characters
    unread: rawUnread === 'true',
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

  // Basic security validation - block obviously dangerous protocols
  const trimmed = decoded.trim()
  if (
    trimmed.toLowerCase().startsWith('javascript:') ||
    trimmed.toLowerCase().startsWith('data:') ||
    trimmed.toLowerCase().startsWith('vbscript:')
  ) {
    return ''
  }

  // Basic URL format check - must look like a URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return ''
  }

  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
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
