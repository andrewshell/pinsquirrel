// Entities
export type { 
  User, 
  CreateUserData, 
  UpdateUserData
} from './entities/user.js'
export type {
  Pin,
  CreatePinData,
  UpdatePinData
} from './entities/pin.js'
export type {
  Tag,
  CreateTagData,
  UpdateTagData,
  TagWithCount
} from './entities/tag.js'
export type {
  PasswordResetToken,
  CreatePasswordResetTokenData,
  PasswordResetRequest,
  PasswordResetConfirmation
} from './entities/password-reset-token.js'

// Interfaces
export type { Repository } from './interfaces/repository.js'
export type { UserRepository } from './interfaces/user-repository.js'
export type { PinRepository, PinFilter } from './interfaces/pin-repository.js'
export type { TagRepository } from './interfaces/tag-repository.js'
export type { PasswordResetRepository } from './interfaces/password-reset-repository.js'
export type { EmailService } from './interfaces/email-service.js'

// Services
export { PinService } from './services/pin-service.js'
export { HttpMetadataService, type MetadataService, type MetadataResult } from './services/metadata-service.js'

// Errors
export { 
  AuthenticationError, 
  InvalidCredentialsError, 
  UserAlreadyExistsError,
  PasswordResetError,
  InvalidResetTokenError,
  ResetTokenExpiredError,
  ResetTokenNotFoundError,
  TooManyResetRequestsError,
  EmailSendError
} from './errors/auth-errors.js'
export {
  PinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
  TagError,
  TagNotFoundError,
  UnauthorizedTagAccessError,
  DuplicateTagError
} from './errors/pin-errors.js'
export {
  MetadataError,
  InvalidUrlError,
  UnsupportedProtocolError,
  FetchTimeoutError,
  HttpError,
  ParseError,
} from './errors/metadata-errors.js'

// Utils
export { CheerioHtmlParser, type HtmlParser } from './utils/html-parser.js'
export { NodeHttpFetcher, type HttpFetcher } from './utils/http-fetcher.js'
export {
  calculatePagination,
  createPaginatedResponse,
  parsePaginationParams,
  type PaginationOptions,
  type PaginationResult,
  type PaginatedData,
} from './utils/pagination.js'
export {
  isValidUrl,
  validateUrl,
  normalizeUrl,
  isSafeForFetching,
  validatePublicUrl,
  type UrlValidationResult,
} from './utils/url-validation.js'

// Validation
export * from './validation/index.js'