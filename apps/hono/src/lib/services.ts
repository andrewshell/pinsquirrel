import { CheerioHtmlParser, NodeHttpFetcher } from '@pinsquirrel/adapters'
import type { EmailService } from '@pinsquirrel/domain'
import { MailgunEmailService } from '@pinsquirrel/mailgun'
import {
  AuthenticationService,
  MetadataService,
  PinService,
  TagService,
  UserService,
} from '@pinsquirrel/services'
import {
  userRepository,
  tagRepository,
  pinRepository,
  passwordResetRepository,
} from './db'

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
export const pinService = new PinService(pinRepository)
export const tagService = new TagService(tagRepository)
export const userService = new UserService(userRepository)
export const metadataService = new MetadataService(httpFetcher, htmlParser)

// Export repositories for special cases
export { pinRepository }

// Export static utilities for error handling
export const metadataErrorUtils = {
  getHttpStatusForError: (error: Error) =>
    MetadataService.getHttpStatusForError(error),
  getUserFriendlyMessage: (error: Error) =>
    MetadataService.getUserFriendlyMessage(error),
}
