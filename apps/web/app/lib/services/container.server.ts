import {
  PinService,
  HttpMetadataService,
  AuthenticationService,
} from '@pinsquirrel/services'
import { CheerioHtmlParser, NodeHttpFetcher } from '@pinsquirrel/adapters'
import {
  DrizzlePinRepository,
  DrizzleTagRepository,
  DrizzleUserRepository,
  DrizzlePasswordResetRepository,
  db,
} from '@pinsquirrel/database'
import { MailgunEmailService } from '@pinsquirrel/mailgun'
import type { EmailService } from '@pinsquirrel/domain'

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
export const metadataService = new HttpMetadataService(httpFetcher, htmlParser)

// Export repositories for cases where direct access is still needed
// TODO: These should be removed as we migrate all logic to services
export const repositories = {
  user: userRepository,
  pin: pinRepository,
  tag: tagRepository,
}

// Export static utilities for error handling
export const metadataErrorUtils = {
  getHttpStatusForError: (error: Error) =>
    HttpMetadataService.getHttpStatusForError(error),
  getUserFriendlyMessage: (error: Error) =>
    HttpMetadataService.getUserFriendlyMessage(error),
}
