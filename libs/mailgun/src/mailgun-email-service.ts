import Mailgun from 'mailgun.js'
import type { EmailService, EmailSendError } from '@pinsquirrel/core'
import type { MailgunConfig } from './types.js'
import { createPasswordResetEmailTemplate } from './templates.js'

export class MailgunEmailService implements EmailService {
  private mailgun: any
  private config: MailgunConfig

  constructor(config: MailgunConfig) {
    this.config = config
    
    const mailgun = new Mailgun(FormData)
    this.mailgun = mailgun.client({
      username: 'api',
      key: config.apiKey,
      url: config.baseUrl || 'https://api.mailgun.net',
    })
  }

  async sendPasswordResetEmail(
    email: string,
    token: string,
    resetUrl: string
  ): Promise<void> {
    if (!email || !token || !resetUrl) {
      const { EmailSendError } = await import('@pinsquirrel/core')
      throw new EmailSendError('Invalid email parameters: email, token, and resetUrl are required')
    }

    try {
      const { html, text } = createPasswordResetEmailTemplate(resetUrl)
      
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
      const { EmailSendError } = await import('@pinsquirrel/core')
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Unknown error occurred'
      
      throw new EmailSendError(`Failed to send password reset email: ${errorMessage}`)
    }
  }
}