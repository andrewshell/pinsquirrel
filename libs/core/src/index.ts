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
  UpdateTagData
} from './entities/tag.js'

// Interfaces
export type { Repository } from './interfaces/repository.js'
export type { UserRepository } from './interfaces/user-repository.js'
export type { AuthenticationService } from './interfaces/authentication-service.js'
export type { PinRepository } from './interfaces/pin-repository.js'
export type { TagRepository } from './interfaces/tag-repository.js'
export type { PinService } from './interfaces/pin-service.js'

// Services
export { AuthenticationServiceImpl } from './services/authentication-service.js'
export { PinServiceImpl } from './services/pin-service.js'
export { HttpMetadataService, type MetadataService, type MetadataResult } from './services/metadata-service.js'

// Errors
export { AuthenticationError, InvalidCredentialsError, UserAlreadyExistsError } from './errors/auth-errors.js'
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

// Utils
export { hashPassword, verifyPassword, hashEmail } from './utils/crypto.js'
export { CheerioHtmlParser, type HtmlParser } from './utils/html-parser.js'
export { NodeHttpFetcher, type HttpFetcher } from './utils/http-fetcher.js'

// Validation
export * from './validation/index.js'