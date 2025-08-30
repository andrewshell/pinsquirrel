// Pure domain exports for @pinsquirrel/domain
// Contains only TypeScript types, interfaces, and error classes - no validation logic

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
export { 
  Pagination,
  type PaginationOptions
} from './entities/pagination.js'
export {
  AccessControl,
  type AccessGateable
} from './entities/access.js'

// Interfaces
export type { Repository } from './interfaces/repository.js'
export type { UserRepository } from './interfaces/user-repository.js'
export type { PinRepository, PinFilter } from './interfaces/pin-repository.js'
export type { TagRepository } from './interfaces/tag-repository.js'
export type { PasswordResetRepository } from './interfaces/password-reset-repository.js'
export type { EmailService } from './interfaces/email-service.js'
export type { HttpFetcher } from './interfaces/http-fetcher.js'
export type { HtmlParser, MetadataResult } from './interfaces/html-parser.js'

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
} from './errors/auth.js'
export {
  PinError,
  PinNotFoundError,
  UnauthorizedPinAccessError,
  DuplicatePinError,
  TagError,
  TagNotFoundError,
  UnauthorizedTagAccessError,
  DuplicateTagError
} from './errors/pin.js'
export {
  MetadataError,
  InvalidUrlError,
  UnsupportedProtocolError,
  FetchTimeoutError,
  HttpError,
  ParseError,
} from './errors/metadata.js'
export {
  ValidationError
} from './errors/validation.js'
export type {
  FieldErrors
} from './errors/validation.js'