import {
  PinService,
  HttpMetadataService,
  CheerioHtmlParser,
  NodeHttpFetcher,
} from '@pinsquirrel/core'
import { AuthenticationService } from '@pinsquirrel/core/server'
import {
  DrizzlePinRepository,
  DrizzleTagRepository,
  DrizzleUserRepository,
  db,
} from '@pinsquirrel/database'

// Create repository instances
const userRepository = new DrizzleUserRepository(db)
const tagRepository = new DrizzleTagRepository(db)
const pinRepository = new DrizzlePinRepository(db, tagRepository)

// Create utility instances for metadata service
const htmlParser = new CheerioHtmlParser()
const httpFetcher = new NodeHttpFetcher()

// Create service instances
export const authService = new AuthenticationService(userRepository)
export const pinService = new PinService(pinRepository, tagRepository)
export const metadataService = new HttpMetadataService(httpFetcher, htmlParser)

// Export repositories for cases where direct access is still needed
// TODO: These should be removed as we migrate all logic to services
export const repositories = {
  user: userRepository,
  pin: pinRepository,
  tag: tagRepository,
}
