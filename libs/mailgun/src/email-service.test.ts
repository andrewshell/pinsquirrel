import { describe, it, expect, vi, beforeEach, Mock } from 'vitest'
import { MailgunEmailService } from './email-service.js'
import type { MailgunConfig } from './types.js'
import { EmailSendError } from '@pinsquirrel/domain'

// Mock mailgun.js
vi.mock('mailgun.js', () => ({
  default: vi.fn(() => ({
    client: vi.fn(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  })),
}))

describe('MailgunEmailService', () => {
  let emailService: MailgunEmailService
  let mockConfig: MailgunConfig
  let mockMailgunClient: any
  let mockCreateMessage: Mock

  beforeEach(() => {
    mockCreateMessage = vi.fn()
    mockMailgunClient = {
      messages: {
        create: mockCreateMessage,
      },
    }

    // Reset mocks
    vi.clearAllMocks()

    mockConfig = {
      apiKey: 'test-api-key',
      domain: 'example.com',
      fromEmail: 'noreply@example.com',
      fromName: 'PinSquirrel',
    }

    emailService = new MailgunEmailService(mockConfig)

    // Mock the mailgun client
    ;(emailService as any).mailgun = mockMailgunClient
  })

  describe('constructor', () => {
    it('should create service with valid config', () => {
      const service = new MailgunEmailService(mockConfig)
      expect(service).toBeInstanceOf(MailgunEmailService)
    })

    it('should create service with minimal config', () => {
      const minimalConfig: MailgunConfig = {
        apiKey: 'test-key',
        domain: 'test.com',
        fromEmail: 'test@test.com',
      }

      const service = new MailgunEmailService(minimalConfig)
      expect(service).toBeInstanceOf(MailgunEmailService)
    })

    it('should create service with custom baseUrl', () => {
      const configWithBaseUrl: MailgunConfig = {
        ...mockConfig,
        baseUrl: 'https://api.eu.mailgun.net',
      }

      const service = new MailgunEmailService(configWithBaseUrl)
      expect(service).toBeInstanceOf(MailgunEmailService)
    })
  })

  describe('sendPasswordResetEmail', () => {
    const testEmail = 'user@example.com'
    const testToken = 'reset-token-123'
    const testResetUrl =
      'https://app.pinsquirrel.com/reset-password/reset-token-123'

    beforeEach(() => {
      mockCreateMessage.mockResolvedValue({
        id: '<test-message-id@example.com>',
        message: 'Queued. Thank you.',
      })
    })

    it('should send password reset email successfully', async () => {
      await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      expect(mockCreateMessage).toHaveBeenCalledTimes(1)
      expect(mockCreateMessage).toHaveBeenCalledWith(
        mockConfig.domain,
        expect.objectContaining({
          from: `${mockConfig.fromName} <${mockConfig.fromEmail}>`,
          to: [testEmail],
          subject: 'Reset Your PinSquirrel Password',
          html: expect.stringContaining(`${testResetUrl}/${testToken}`),
          text: expect.stringContaining(`${testResetUrl}/${testToken}`),
        })
      )
    })

    it('should include token in email content', async () => {
      await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.html).toContain(`${testResetUrl}/${testToken}`)
      expect(messageData.text).toContain(`${testResetUrl}/${testToken}`)
    })

    it('should use configured fromName when provided', async () => {
      await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.from).toBe(
        `${mockConfig.fromName} <${mockConfig.fromEmail}>`
      )
    })

    it('should use email only when fromName not provided', async () => {
      const configWithoutName: MailgunConfig = {
        ...mockConfig,
        fromName: undefined,
      }

      const serviceWithoutName = new MailgunEmailService(configWithoutName)
      ;(serviceWithoutName as any).mailgun = mockMailgunClient

      await serviceWithoutName.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.from).toBe(mockConfig.fromEmail)
    })

    it('should handle HTML and text content properly', async () => {
      await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.html).toContain('<a href="')
      expect(messageData.html).toContain(`${testResetUrl}/${testToken}`)
      expect(messageData.text).toContain(`${testResetUrl}/${testToken}`)
      expect(messageData.text).not.toContain('<a href="')
    })

    it('should throw EmailSendError when Mailgun API fails', async () => {
      const errorMessage = 'API key is invalid'
      mockCreateMessage.mockRejectedValue(new Error(errorMessage))

      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, testResetUrl)
      ).rejects.toThrow(EmailSendError)

      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, testResetUrl)
      ).rejects.toThrow(`Failed to send password reset email: ${errorMessage}`)
    })

    it('should throw EmailSendError with generic message for unknown errors', async () => {
      mockCreateMessage.mockRejectedValue('Unknown error')

      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, testResetUrl)
      ).rejects.toThrow(EmailSendError)

      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, testResetUrl)
      ).rejects.toThrow('Failed to send password reset email')
    })

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockCreateMessage.mockRejectedValue(timeoutError)

      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, testResetUrl)
      ).rejects.toThrow(EmailSendError)
    })

    it('should handle authentication errors', async () => {
      const authError = new Error('Forbidden')
      mockCreateMessage.mockRejectedValue(authError)

      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, testResetUrl)
      ).rejects.toThrow('Failed to send password reset email: Forbidden')
    })

    it('should validate email parameters', async () => {
      // Test with empty email
      await expect(
        emailService.sendPasswordResetEmail('', testToken, testResetUrl)
      ).rejects.toThrow()

      // Test with empty token
      await expect(
        emailService.sendPasswordResetEmail(testEmail, '', testResetUrl)
      ).rejects.toThrow()

      // Test with empty reset URL
      await expect(
        emailService.sendPasswordResetEmail(testEmail, testToken, '')
      ).rejects.toThrow()
    })

    it('should include proper email headers', async () => {
      await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.subject).toBe('Reset Your PinSquirrel Password')
      expect(messageData.to).toEqual([testEmail])
    })

    it('should create message for correct domain', async () => {
      await emailService.sendPasswordResetEmail(
        testEmail,
        testToken,
        testResetUrl
      )

      const domainCall = mockCreateMessage.mock.calls[0][0]
      expect(domainCall).toBe(mockConfig.domain)
    })
  })

  describe('sendSignupNotificationEmail', () => {
    const testNotifyEmail = 'admin@example.com'
    const testUsername = 'newuser'
    const testUserEmail = 'newuser@example.com'

    beforeEach(() => {
      mockCreateMessage.mockResolvedValue({
        id: '<test-message-id@example.com>',
        message: 'Queued. Thank you.',
      })
    })

    it('should send signup notification email successfully', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      expect(mockCreateMessage).toHaveBeenCalledTimes(1)
      expect(mockCreateMessage).toHaveBeenCalledWith(
        mockConfig.domain,
        expect.objectContaining({
          from: `${mockConfig.fromName} <${mockConfig.fromEmail}>`,
          to: [testNotifyEmail],
          'h:Reply-To': testUserEmail,
          subject: `New Signup: ${testUsername}`,
          html: expect.stringContaining(testUsername),
          text: expect.stringContaining(testUsername),
        })
      )
    })

    it('should include username and email in content', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.html).toContain(testUsername)
      expect(messageData.html).toContain(testUserEmail)
      expect(messageData.text).toContain(testUsername)
      expect(messageData.text).toContain(testUserEmail)
    })

    it('should set reply-to header to user email', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData['h:Reply-To']).toBe(testUserEmail)
    })

    it('should send to notify email address', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.to).toEqual([testNotifyEmail])
    })

    it('should use correct subject line', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.subject).toBe(`New Signup: ${testUsername}`)
    })

    it('should throw EmailSendError when parameters are missing', async () => {
      // Test with empty notifyEmail
      await expect(
        emailService.sendSignupNotificationEmail(
          '',
          testUsername,
          testUserEmail
        )
      ).rejects.toThrow(EmailSendError)

      // Test with empty username
      await expect(
        emailService.sendSignupNotificationEmail(
          testNotifyEmail,
          '',
          testUserEmail
        )
      ).rejects.toThrow(EmailSendError)

      // Test with empty userEmail
      await expect(
        emailService.sendSignupNotificationEmail(
          testNotifyEmail,
          testUsername,
          ''
        )
      ).rejects.toThrow(EmailSendError)
    })

    it('should handle Mailgun API errors', async () => {
      const mailgunError = new Error('API rate limit exceeded')
      mockCreateMessage.mockRejectedValue(mailgunError)

      await expect(
        emailService.sendSignupNotificationEmail(
          testNotifyEmail,
          testUsername,
          testUserEmail
        )
      ).rejects.toThrow(EmailSendError)
      await expect(
        emailService.sendSignupNotificationEmail(
          testNotifyEmail,
          testUsername,
          testUserEmail
        )
      ).rejects.toThrow('Failed to send signup notification email')
    })

    it('should use configured fromName when provided', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.from).toBe(
        `${mockConfig.fromName} <${mockConfig.fromEmail}>`
      )
    })

    it('should use email only when fromName not provided', async () => {
      const configWithoutName: MailgunConfig = {
        ...mockConfig,
        fromName: undefined,
      }

      const serviceWithoutName = new MailgunEmailService(configWithoutName)
      ;(serviceWithoutName as any).mailgun = mockMailgunClient

      await serviceWithoutName.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const call = mockCreateMessage.mock.calls[0]
      const messageData = call[1]

      expect(messageData.from).toBe(mockConfig.fromEmail)
    })

    it('should create message for correct domain', async () => {
      await emailService.sendSignupNotificationEmail(
        testNotifyEmail,
        testUsername,
        testUserEmail
      )

      const domainCall = mockCreateMessage.mock.calls[0][0]
      expect(domainCall).toBe(mockConfig.domain)
    })
  })
})
