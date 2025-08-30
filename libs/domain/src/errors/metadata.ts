export class MetadataError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = 'MetadataError'
  }
}

export class InvalidUrlError extends MetadataError {
  constructor(url: string) {
    super(`Invalid URL format: ${url}`, 'INVALID_URL')
    this.name = 'InvalidUrlError'
  }
}

export class UnsupportedProtocolError extends MetadataError {
  constructor(protocol: string) {
    super(`Unsupported URL protocol: ${protocol}`, 'UNSUPPORTED_PROTOCOL')
    this.name = 'UnsupportedProtocolError'
  }
}

export class FetchTimeoutError extends MetadataError {
  constructor(url: string) {
    super(`Request timeout while fetching: ${url}`, 'FETCH_TIMEOUT')
    this.name = 'FetchTimeoutError'
  }
}

export class HttpError extends MetadataError {
  constructor(
    public readonly status: number,
    url: string
  ) {
    super(`HTTP ${status} error while fetching: ${url}`, 'HTTP_ERROR')
    this.name = 'HttpError'
  }
}

export class ParseError extends MetadataError {
  constructor(url: string) {
    super(`Failed to parse metadata from: ${url}`, 'PARSE_ERROR')
    this.name = 'ParseError'
  }
}
