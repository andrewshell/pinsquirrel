import type { EmailService } from '@pinsquirrel/domain'
import { EmailSendError } from '@pinsquirrel/domain'
import Mailgun from 'mailgun.js'
import {
  createPasswordResetEmailTemplate,
  createSignupNotificationEmailTemplate,
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
      // url: config.baseUrl || 'https://api.mailgun.net',
    })
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

    try {
      // Construct the full reset URL with the token
      const fullResetUrl = `${resetUrl}/${token}`
      const { html, text } = createPasswordResetEmailTemplate(fullResetUrl)

      const from = this.config.fromName
        ? `${this.config.fromName} <${this.config.fromEmail}>`
        : this.config.fromEmail

      const messageData = {
        from,
        to: [email],
        subject: 'Reset Your PinSquirrel Password',
        html,
        text,
      }

      await this.mailgun.messages.create(this.config.domain, messageData)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      throw new EmailSendError(
        `Failed to send password reset email: ${errorMessage}`
      )
    }
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

    try {
      const { html, text } = createSignupNotificationEmailTemplate(
        username,
        userEmail
      )

      const from = this.config.fromName
        ? `${this.config.fromName} <${this.config.fromEmail}>`
        : this.config.fromEmail

      const messageData = {
        from,
        to: [notifyEmail],
        'h:Reply-To': userEmail,
        subject: `New Signup: ${username}`,
        html,
        text,
      }

      await this.mailgun.messages.create(this.config.domain, messageData)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'

      throw new EmailSendError(
        `Failed to send signup notification email: ${errorMessage}`
      )
    }
  }
}
