// Services - the main API for business logic
export {
  AuthenticationService,
  type EmailSealer,
} from './services/authentication.js'
export { AccountService } from './services/account.js'
export { MaintenanceService, type SweepResult } from './services/maintenance.js'
export {
  NullEmailService,
  EmailNotConfiguredError,
} from './services/null-email.js'
export { MetadataService } from './services/metadata.js'
export { PinService } from './services/pin.js'
export {
  PinboardService,
  InvalidPinboardExportError,
  type PinboardPin,
  type ImportResult,
  type InvalidPinboardExportReason,
} from './services/pinboard.js'
export { TagService } from './services/tag.js'
export { UserService } from './services/user.js'
export { ApiKeyService } from './services/api-key.js'
export {
  OAuthService,
  type AuthorizationOutcome,
  type IssuedTokens,
  type OAuthGrant,
  type OAuthServiceConfig,
  type ResolvedAuthorizationRequest,
  type VerifiedAccessToken,
} from './services/oauth.js'

// Validation schemas (shared between REST, MCP, and other transports)
export {
  pinListInputSchema,
  pinGetInputSchema,
  tagListInputSchema,
  pinFilterFromInput,
  type PinListInput,
  type TagListInput,
} from './validation/pin-query.js'

// String-coercion query schemas (for HTTP query string inputs)
export {
  pinListQuerySchema,
  tagListQuerySchema,
} from './validation/query-coerce.js'

// OAuth URI rules (shared by the service layer and the app's metadata routes)
export {
  canonicalizeRedirectUri,
  isLoopbackRedirectHost,
  matchRedirectUri,
  normalizeOAuthUri,
  protectedResourceMetadataPath,
  redirectUriMatches,
} from './validation/oauth-uri.js'

// OAuth wire-format schemas (authorize, token, registration, CIMD)
export {
  authorizationRequestSchema,
  authorizationCodeGrantSchema,
  clientIdMetadataDocumentSchema,
  clientRegistrationSchema,
  refreshTokenGrantSchema,
  staticOAuthClientsSchema,
  tokenRequestSchema,
  type AuthorizationRequestParams,
  type AuthorizationCodeGrantParams,
  type ClientIdMetadataDocument,
  type ClientRegistrationMetadata,
  type RefreshTokenGrantParams,
  type StaticOAuthClientMetadata,
  type TokenRequestParams,
} from './validation/oauth.js'

// Response schemas (service output shapes)
export {
  pinSchema,
  tagSchema,
  tagWithCountSchema,
  paginationSchema,
  paginatedPinsSchema,
  errorSchema,
} from './validation/responses.js'

// Utilities
export { md5 } from './utils/crypto.js'
export { booleanFromString, numberFromString } from './utils/zod-coerce.js'
