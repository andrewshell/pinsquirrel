import { CheerioHtmlParser, NodeHttpFetcher } from '@pinsquirrel/adapters'
import {
  createDatabaseClient,
  DrizzlePasswordResetRepository,
  DrizzlePinRepository,
  DrizzleTagRepository,
  DrizzleUserRepository,
} from '@pinsquirrel/database'
import type { EmailService } from '@pinsquirrel/domain'
import { MailgunEmailService } from '@pinsquirrel/mailgun'
import {
  AuthenticationService,
  MetadataService,
  PinService,
  TagService,
  UserService,
} from '@pinsquirrel/services'

// Create database client
const db = createDatabaseClient(
  process.env.DATABASE_URL || 'postgresql://localhost:5432/pinsquirrel'
)

// Create repository instances
const userRepository = new DrizzleUserRepository(db)
const tagRepository = new DrizzleTagRepository(db)
const pinRepository = new DrizzlePinRepository(db, tagRepository)
const passwordResetRepository = new DrizzlePasswordResetRepository(db)

// Create utility instances for metadata service
const htmlParser = new CheerioHtmlParser()
const httpFetcher = new NodeHttpFetcher()

// Create email service if Mailgun is configured
let emailService: EmailService | undefined
if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
  emailService = new MailgunEmailService({
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
    fromEmail: process.env.MAILGUN_FROM_EMAIL || 'noreply@pinsquirrel.com',
    fromName: process.env.MAILGUN_FROM_NAME || 'PinSquirrel',
  })
}

// Create service instances
export const authService = new AuthenticationService(
  userRepository,
  passwordResetRepository,
  emailService
)
export const pinService = new PinService(pinRepository, tagRepository)
export const tagService = new TagService(tagRepository)
export const userService = new UserService(userRepository)
export const metadataService = new MetadataService(httpFetcher, htmlParser)

// Export static utilities for error handling
export const metadataErrorUtils = {
  getHttpStatusForError: (error: Error) =>
    MetadataService.getHttpStatusForError(error),
  getUserFriendlyMessage: (error: Error) =>
    MetadataService.getUserFriendlyMessage(error),
}
