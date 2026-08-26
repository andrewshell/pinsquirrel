/**
 * OAuth 2.1 failures, named by the code they travel as.
 *
 * Every error here carries the RFC 6749 §4.1.2.1 / §5.2 `error` value it
 * serialises to (RFC 7591 §3.2.2 for `invalid_client_metadata`, RFC 8707 §2
 * for `invalid_target`). The transport reads `code` and puts it in the
 * response body or the redirect query string; it never invents one. Clients
 * recover on the code and nothing else — Claude re-runs consent on
 * `invalid_grant` and gives up on anything it does not recognise — so a
 * custom code is a dead connection with no diagnostic.
 *
 * The message is the human-readable `error_description`. It is safe to make
 * it specific: these are protocol failures, not credential checks, and none
 * of them says whether a given token or account exists.
 */
export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'OAuthError'
  }
}

/** Missing, malformed, or repeated parameter. */
export class OAuthInvalidRequestError extends OAuthError {
  constructor(message = 'The request is missing or has a malformed parameter') {
    super('invalid_request', message)
    this.name = 'OAuthInvalidRequestError'
  }
}

/** Client authentication failed, or the `client_id` is not registered. */
export class OAuthInvalidClientError extends OAuthError {
  constructor(message = 'Client authentication failed') {
    super('invalid_client', message)
    this.name = 'OAuthInvalidClientError'
  }
}

/**
 * The authorization code or refresh token is invalid, expired, revoked, or
 * was issued to another client. Also the PKCE verifier mismatch: a client
 * that cannot prove possession did not present a valid grant.
 */
export class OAuthInvalidGrantError extends OAuthError {
  constructor(message = 'The provided grant is invalid or has expired') {
    super('invalid_grant', message)
    this.name = 'OAuthInvalidGrantError'
  }
}

/** The client is registered but not for this grant type or response type. */
export class OAuthUnauthorizedClientError extends OAuthError {
  constructor(message = 'The client is not authorized to use this grant type') {
    super('unauthorized_client', message)
    this.name = 'OAuthUnauthorizedClientError'
  }
}

/** A grant type this server does not implement. */
export class OAuthUnsupportedGrantTypeError extends OAuthError {
  constructor(message = 'The grant type is not supported') {
    super('unsupported_grant_type', message)
    this.name = 'OAuthUnsupportedGrantTypeError'
  }
}

/** A scope that is unknown, or broader than the one already granted. */
export class OAuthInvalidScopeError extends OAuthError {
  constructor(message = 'The requested scope is invalid or unknown') {
    super('invalid_scope', message)
    this.name = 'OAuthInvalidScopeError'
  }
}

/**
 * The `resource` parameter (RFC 8707) names something this server does not
 * issue tokens for. Audience binding is the confused-deputy defense, so an
 * unrecognised resource is refused rather than defaulted.
 */
export class OAuthInvalidTargetError extends OAuthError {
  constructor(message = 'The requested resource is invalid or unknown') {
    super('invalid_target', message)
    this.name = 'OAuthInvalidTargetError'
  }
}

/** The user declined at the consent screen. */
export class OAuthAccessDeniedError extends OAuthError {
  constructor(message = 'The user denied the authorization request') {
    super('access_denied', message)
    this.name = 'OAuthAccessDeniedError'
  }
}

/**
 * Registration metadata that does not validate: a bad `redirect_uris`, a
 * CIMD document whose `client_id` does not match the URL it was fetched
 * from, an unsupported auth method (RFC 7591 §3.2.2).
 */
export class OAuthInvalidClientMetadataError extends OAuthError {
  constructor(message = 'The client metadata is invalid') {
    super('invalid_client_metadata', message)
    this.name = 'OAuthInvalidClientMetadataError'
  }
}
