import { InvalidUrlError, UnsupportedProtocolError } from '@pinsquirrel/domain'

/**
 * Validates a URL for metadata fetching with security checks
 */
export function validateUrlForFetching(urlString: string): URL {
  // Basic type and empty string validation
  if (typeof urlString !== 'string' || !urlString.trim()) {
    throw new InvalidUrlError(urlString)
  }

  // Parse URL
  let url: URL
  try {
    url = new URL(urlString.trim())
  } catch {
    throw new InvalidUrlError(urlString)
  }

  // Check protocol - only HTTP and HTTPS allowed
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsupportedProtocolError(url.protocol)
  }

  // Check if hostname exists
  if (!url.hostname) {
    throw new InvalidUrlError(urlString)
  }

  // SSRF protection - block private/local addresses
  if (!isSafeForFetching(url)) {
    throw new InvalidUrlError(urlString)
  }

  return url
}

/**
 * Check if a URL is safe for fetching (prevents SSRF attacks)
 */
function isSafeForFetching(url: URL): boolean {
  const hostname = url.hostname.toLowerCase()

  // Block localhost (IPv6 localhost includes brackets in hostname)
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return false
  }

  // Block private IP ranges (basic check)
  if (
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.')
  ) {
    return false
  }

  // Block .local domains
  if (hostname.endsWith('.local')) {
    return false
  }

  return true
}
