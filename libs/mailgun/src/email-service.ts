import type { EmailService } from '@pinsquirrel/domain'
import { EmailSendError } from '@pinsquirrel/domain'
import Mailgun from 'mailgun.js'
import {
  createPasswordResetEmailTemplate,
  createSignupNotificationEmailTemplate,
  createEmailAlreadyRegisteredTemplate,
  createUsernameTakenTemplate,
} from './templates.js'
import type { MailgunConfig, SendResult } from './types.js'
import { REQUEST_TIMEOUT_MS, withRetry } from './retry.js'

export class MailgunEmailService implements EmailService {
  private mailgun: ReturnType<Mailgun['client']>
  private config: MailgunConfig

  constructor(config: MailgunConfig) {
    this.config = config

    const mailgun = new Mailgun(FormData)
    this.mailgun = mailgun.client({
      username: 'api',
      key: config.apiKey,
      // Explicit rather than left to the library's default: baseUrl is the
      // only way to reach the EU region, and while this line was commented
      // out an EU config posted to the US API without saying so.
      url: config.baseUrl ?? 'https://api.mailgun.net',
      timeout: REQUEST_TIMEOUT_MS,
    })
  }

  /**
   * The one place a message is posted to Mailgun: the from-line, the create
   * call, and the EmailSendError wrapping. `description` names the mail in the
   * failure message ("password reset email").
   */
  private async send(
    to: string,
    subject: string,
    body: { html?: string; text: string },
    options: {
      description: string
      headers?: Record<string, string>
      /**
       * Retry transient failures with backoff. Off for the transactional
       * mails, which are sent inside a user's request/response cycle where
       * three attempts would hold the response open for a second and a half;
       * on for the operator console's bulk send, where nobody is waiting and
       * a dropped announcement cannot be resent selectively.
       */
      retry?: boolean
    }
  ): Promise<void> {
    const from = this.config.fromName
      ? `${this.config.fromName} <${this.config.fromEmail}>`
      : this.config.fromEmail

    const post = () =>
      this.mailgun.messages.create(this.config.domain, {
        from,
        to: [to],
        ...options.headers,
        subject,
        ...body,
      })

    try {
      if (options.retry) {
        await withRetry(post)
      } else {
        await post()
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      throw new EmailSendError(
        `Failed to send ${options.description}: ${errorMessage}`,
        { cause: error }
      )
    }
  }

  /**
   * Send one plain-text message. No template and no html part: the operator
   * console composes the body itself, so there is nothing here to render.
   */
  async sendPlainText(
    to: string,
    subject: string,
    text: string
  ): Promise<void> {
    await this.send(
      to,
      subject,
      { text },
      {
        description: `message to ${to}`,
        retry: true,
      }
    )
  }

  /**
   * Send a plain-text message to each recipient individually.
   *
   * One Mailgun message per address, so recipients never see each other and one
   * failure does not block the rest. Failures are reported per recipient rather
   * than thrown: a partial send is the normal outcome for a waitlist blast, and
   * the operator needs to see which addresses to chase.
   */
  async sendBulk(
    recipients: string[],
    subject: string,
    text: string
  ): Promise<SendResult[]> {
    const results: SendResult[] = []
    for (const recipient of recipients) {
      try {
        await this.sendPlainText(recipient, subject, text)
        results.push({ recipient, ok: true })
      } catch (error) {
        // The provider's own message, not this class's wrapping of it: the
        // recipient is already the row's key, so repeating it reads as noise.
        const cause = error instanceof Error ? (error.cause ?? error) : error
        results.push({
          recipient,
          ok: false,
          error: cause instanceof Error ? cause.message : String(cause),
        })
      }
    }
    return results
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    resetUrl: string
  ): Promise<void> {
    if (!email || !token || !resetUrl) {
      throw new EmailSendError(
        'Invalid email parameters: email, token, and resetUrl are required'
      )
    }

    // Construct the full reset URL with the token
    const fullResetUrl = `${resetUrl}/${token}`

    await this.send(
      email,
      'Reset Your PinSquirrel Password',
      createPasswordResetEmailTemplate(fullResetUrl),
      { description: 'password reset email' }
    )
  }

  async sendSignupNotificationEmail(
    notifyEmail: string,
    username: string,
    userEmail: string
  ): Promise<void> {
    if (!notifyEmail || !username || !userEmail) {
      throw new EmailSendError(
        'Invalid email parameters: notifyEmail, username, and userEmail are required'
      )
    }

    await this.send(
      notifyEmail,
      `New Signup: ${username}`,
      createSignupNotificationEmailTemplate(username, userEmail),
      {
        description: 'signup notification email',
        headers: { 'h:Reply-To': userEmail },
      }
    )
  }

  async sendEmailAlreadyRegisteredEmail(
    email: string,
    signinUrl: string
  ): Promise<void> {
    if (!email || !signinUrl) {
      throw new EmailSendError(
        'Invalid email parameters: email and signinUrl are required'
      )
    }

    await this.send(
      email,
      'PinSquirrel Account Already Exists',
      createEmailAlreadyRegisteredTemplate(signinUrl),
      { description: 'already-registered email' }
    )
  }

  async sendUsernameTakenEmail(
    email: string,
    username: string,
    signupUrl: string
  ): Promise<void> {
    if (!email || !username || !signupUrl) {
      throw new EmailSendError(
        'Invalid email parameters: email, username, and signupUrl are required'
      )
    }

    await this.send(
      email,
      'PinSquirrel Username Unavailable',
      createUsernameTakenTemplate(username, signupUrl),
      { description: 'username-taken email' }
    )
  }
}
