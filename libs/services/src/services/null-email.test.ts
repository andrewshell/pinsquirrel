import { describe, it, expect } from 'vitest'
import { NullEmailService, EmailNotConfiguredError } from './null-email.js'

describe('NullEmailService', () => {
  const service = new NullEmailService()

  // Every method rejects rather than resolving silently. A deployment with no
  // mail provider should look like a provider that is down — a path callers
  // already handle — rather than one that reports success having sent nothing.
  it.each([
    [
      'sendPasswordResetEmail',
      () => service.sendPasswordResetEmail('a@b.com', 't', 'url'),
    ],
    [
      'sendSignupNotificationEmail',
      () => service.sendSignupNotificationEmail('a@b.com', 'u', 'e@f.com'),
    ],
    [
      'sendEmailAlreadyRegisteredEmail',
      () => service.sendEmailAlreadyRegisteredEmail('a@b.com', 'url'),
    ],
    [
      'sendUsernameTakenEmail',
      () => service.sendUsernameTakenEmail('a@b.com', 'u', 'url'),
    ],
  ])('%s rejects with EmailNotConfiguredError', async (_name, call) => {
    await expect(call()).rejects.toThrow(EmailNotConfiguredError)
  })
})
