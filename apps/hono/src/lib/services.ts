import { CheerioHtmlParser, NodeHttpFetcher } from '@pinsquirrel/adapters'
import { createEmailSealer } from '@pinsquirrel/crypto'
import type { EmailService } from '@pinsquirrel/domain'
import { MailgunEmailService } from '@pinsquirrel/mailgun'
import {
  AccountService,
  ApiKeyService,
  NullEmailService,
  AuthenticationService,
  MetadataService,
  PinboardService,
  PinService,
  TagService,
  UserService,
  type EmailSealer,
} from '@pinsquirrel/services'
import {
  apiKeyRepository,
  userRepository,
  tagRepository,
  pinRepository,
  passwordResetRepository,
} from './db'

// Create utility instances for metadata service
const htmlParser = new CheerioHtmlParser()
const httpFetcher = new NodeHttpFetcher()

// Create the email service if Mailgun is configured. Without it every send
// fails loudly instead of being skipped: an unconfigured install then reports
// "we had trouble sending your confirmation email" on signup rather than
// telling the user to check an inbox nothing was sent to.
const emailService: EmailService =
  process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN
    ? new MailgunEmailService({
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
        fromEmail: process.env.MAILGUN_FROM_EMAIL || 'noreply@pinsquirrel.com',
        fromName: process.env.MAILGUN_FROM_NAME || 'PinSquirrel',
      })
    : new NullEmailService()

// Seal waitlist emails if a public key is configured, so they can be contacted
// later via the offline admin app; this server can never decrypt them. The
// sealer validates the key on construction, so a bad EMAIL_PUBLIC_KEY fails at
// boot rather than the first time an auth flow tries to seal an address.
let emailSealer: EmailSealer | undefined
if (process.env.EMAIL_PUBLIC_KEY) {
  try {
    emailSealer = createEmailSealer(process.env.EMAIL_PUBLIC_KEY)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `EMAIL_PUBLIC_KEY is invalid: ${detail}. ` +
        'Generate one with: pnpm --filter @pinsquirrel/crypto keygen',
      { cause: error }
    )
  }
}

// Create service instances
export const authService = new AuthenticationService(userRepository)
export const accountService = new AccountService(
  userRepository,
  passwordResetRepository,
  emailService,
  emailSealer
)
export const pinService = new PinService(pinRepository)
export const pinboardService = new PinboardService(pinService)
export const tagService = new TagService(tagRepository)
export const userService = new UserService(userRepository)
export const apiKeyService = new ApiKeyService(apiKeyRepository, userRepository)
export const metadataService = new MetadataService(httpFetcher, htmlParser)

// Export static utilities for error handling
export const metadataErrorUtils = {
  getHttpStatusForError: (error: Error) =>
    MetadataService.getHttpStatusForError(error),
  getUserFriendlyMessage: (error: Error) =>
    MetadataService.getUserFriendlyMessage(error),
}
