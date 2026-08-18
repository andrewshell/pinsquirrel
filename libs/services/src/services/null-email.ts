import type { EmailService } from '@pinsquirrel/domain'

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email delivery is not configured')
    this.name = 'EmailNotConfiguredError'
  }
}

/**
 * The EmailService for a deployment with no mail provider configured.
 *
 * Every send rejects, so an unconfigured install behaves like a provider that
 * is down — a path callers already handle — rather than one that reports
 * success having sent nothing. `AccountService.register` catches the rejection
 * and returns `emailFailed: true`, which the sign-up page already renders as
 * "we had trouble sending your confirmation email".
 *
 * This exists so AccountService can take its email dependency as required.
 * Choosing it is the app's decision, made visibly in the composition root,
 * rather than a silent branch inside the service.
 */
export class NullEmailService implements EmailService {
  // Typed by the interface so callers get the real arity, implemented with a
  // zero-parameter arrow so there are no unused bindings to silence.
  readonly sendPasswordResetEmail: EmailService['sendPasswordResetEmail'] =
    () => Promise.reject(new EmailNotConfiguredError())

  readonly sendSignupNotificationEmail: EmailService['sendSignupNotificationEmail'] =
    () => Promise.reject(new EmailNotConfiguredError())

  readonly sendEmailAlreadyRegisteredEmail: EmailService['sendEmailAlreadyRegisteredEmail'] =
    () => Promise.reject(new EmailNotConfiguredError())

  readonly sendUsernameTakenEmail: EmailService['sendUsernameTakenEmail'] =
    () => Promise.reject(new EmailNotConfiguredError())
}
