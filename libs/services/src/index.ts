// Services - the main API for business logic
export { AuthenticationService } from './services/authentication.js'
export { MetadataService } from './services/metadata.js'
export { PinService } from './services/pin.js'
export { TagService } from './services/tag.js'
export { UserService } from './services/user.js'
export { ApiKeyService } from './services/api-key.js'

// Validation schemas (shared between REST, MCP, and other transports)
export {
  pinListInputSchema,
  pinGetInputSchema,
  tagListInputSchema,
  type PinListInput,
  type TagListInput,
} from './validation/pin-query.js'

// String-coercion query schemas (for HTTP query string inputs)
export {
  pinListQuerySchema,
  tagListQuerySchema,
} from './validation/query-coerce.js'

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
