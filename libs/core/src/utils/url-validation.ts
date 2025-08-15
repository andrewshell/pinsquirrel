/**
 * URL validation utilities
 */

export interface UrlValidationResult {
  isValid: boolean
  url?: URL
  error?: string
}

/**
 * Validate if a string is a valid HTTP/HTTPS URL
 */
export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Validate and parse a URL with detailed error information
 */
export function validateUrl(urlString: string): UrlValidationResult {
  if (typeof urlString !== 'string') {
    return {
      isValid: false,
      error: 'URL is required and must be a string',
    }
  }

  if (!urlString || urlString.trim() === '') {
    return {
      isValid: false,
      error: 'URL cannot be empty',
    }
  }

  let url: URL
  try {
    url = new URL(urlString.trim())
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format',
    }
  }

  // Check protocol
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      isValid: false,
      error: `Unsupported protocol: ${url.protocol}. Only HTTP and HTTPS are supported`,
    }
  }

  // Check if hostname exists
  if (!url.hostname) {
    return {
      isValid: false,
      error: 'URL must include a hostname',
    }
  }

  return {
    isValid: true,
    url,
  }
}

/**
 * Normalize a URL by trimming whitespace and ensuring proper format
 */
export function normalizeUrl(urlString: string): string {
  const trimmed = urlString.trim()

  // If it doesn't start with a protocol, assume https
  if (!/^https?:\/\//.test(trimmed)) {
    return `https://${trimmed}`
  }

  return trimmed
}

/**
 * Check if a URL is safe for metadata fetching (additional security checks)
 */
export function isSafeForFetching(url: URL): boolean {
  // Reject localhost and private IP ranges for security
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

/**
 * Comprehensive URL validation for public URLs safe for fetching
 */
export function validatePublicUrl(urlString: string): UrlValidationResult {
  const baseValidation = validateUrl(urlString)

  if (!baseValidation.isValid || !baseValidation.url) {
    return baseValidation
  }

  if (!isSafeForFetching(baseValidation.url)) {
    return {
      isValid: false,
      error: 'URL points to a private or local address',
    }
  }

  return baseValidation
}
