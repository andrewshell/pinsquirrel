// Pure domain exports for @pinsquirrel/domain
// Contains only TypeScript types, interfaces, and error classes - no validation logic

// Entities
export type { User, CreateUserData, UpdateUserData } from './entities/user.js'
export { Role } from './entities/role.js'
export { UserStatus } from './entities/user-status.js'
export type { Pin, CreatePinData, UpdatePinData } from './entities/pin.js'
export type {
  Tag,
  CreateTagData,
  UpdateTagData,
  TagWithCount,
} from './entities/tag.js'
export type {
  PasswordResetToken,
  CreatePasswordResetTokenData,
} from './entities/password-reset-token.js'
export type {
  Session,
  CreateSessionData,
  UpdateSessionData,
} from './entities/session.js'
export type {
  OAuthClient,
  OAuthClientRegistrationType,
  CreateOAuthClientData,
  UpdateOAuthClientData,
} from './entities/oauth-client.js'
export type {
  AuthorizationCode,
  CreateAuthorizationCodeData,
  OAuthToken,
  OAuthTokenKind,
  CreateOAuthTokenData,
} from './entities/oauth-grant.js'
export {
  Pagination,
  type PaginationOptions,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './entities/pagination.js'
export { AccessControl, type AccessGateable } from './entities/access.js'

// Type utilities
export type { Jsonify } from './jsonify.js'

// Interfaces
export type { Repository } from './interfaces/repository.js'
export type { UserRepository } from './interfaces/user-repository.js'
export type { PinRepository, PinFilter } from './interfaces/pin-repository.js'
export type { TagRepository } from './interfaces/tag-repository.js'
export type { PasswordResetRepository } from './interfaces/password-reset-repository.js'
export type { SessionRepository } from './interfaces/session-repository.js'
export type { OAuthClientRepository } from './interfaces/oauth-client-repository.js'
export type { OAuthAuthorizationCodeRepository } from './interfaces/oauth-authorization-code-repository.js'
export type { OAuthTokenRepository } from './interfaces/oauth-token-repository.js'
export type { EmailService } from './interfaces/email-service.js'
export type {
  HttpFetcher,
  HttpFetchOptions,
} from './interfaces/http-fetcher.js'
export type { HtmlParser, MetadataResult } from './interfaces/html-parser.js'

// Errors
export {
  AuthenticationError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
  EmailVerificationRequiredError,
  PasswordResetError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  TooManyResetRequestsError,
  EmailSendError,
  MissingRoleError,
  AccessNotGrantedError,
} from './errors/auth.js'
export {
  UserError,
  UserNotFoundError,
  UserNotEligibleError,
  CannotRevokeOwnRoleError,
  UnauthorizedUserAccessError,
} from './errors/user.js'
export {
  PinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
  TagError,
  TagNotFoundError,
  UnauthorizedTagAccessError,
} from './errors/pin.js'
export {
  MetadataError,
  InvalidUrlError,
  UnsupportedProtocolError,
  FetchTimeoutError,
  HttpError,
  ParseError,
} from './errors/metadata.js'
export { ValidationError } from './errors/validation.js'
export {
  OAuthError,
  OAuthInvalidRequestError,
  OAuthInvalidClientError,
  OAuthInvalidGrantError,
  OAuthUnauthorizedClientError,
  OAuthUnsupportedGrantTypeError,
  OAuthInvalidScopeError,
  OAuthInvalidTargetError,
  OAuthAccessDeniedError,
  OAuthInvalidClientMetadataError,
} from './errors/oauth.js'
export {
  isBlockedIpv4,
  isBlockedIpv6,
  isBlockedIpAddress,
} from './ip-address.js'
