import type { EmailService } from '@pinsquirrel/domain'
import { EmailSendError } from '@pinsquirrel/domain'
import Mailgun from 'mailgun.js'
import {
  createPasswordResetEmailTemplate,
  createSignupNotificationEmailTemplate,
  createEmailAlreadyRegisteredTemplate,
  createUsernameTakenTemplate,
} from './templates.js'
import type { MailgunConfig } from './types.js'

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
    body: { html: string; text: string },
    options: { description: string; headers?: Record<string, string> }
  ): Promise<void> {
    try {
      const from = this.config.fromName
        ? `${this.config.fromName} <${this.config.fromEmail}>`
        : this.config.fromEmail

      await this.mailgun.messages.create(this.config.domain, {
        from,
        to: [to],
        ...options.headers,
        subject,
        ...body,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      throw new EmailSendError(
        `Failed to send ${options.description}: ${errorMessage}`
      )
    }
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
