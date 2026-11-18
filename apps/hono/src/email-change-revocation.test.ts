import { randomBytes } from 'node:crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { AccessControl, type EmailService } from '@pinsquirrel/domain'
import { AccountService, AuthenticationService } from '@pinsquirrel/services'
import {
  emailChangeRepository,
  passwordResetRepository,
  userRepository,
} from './lib/db'

/**
 * A pending email change against the real database: ending a user's
 * credentials, by reset or by change, must also end the change they asked for
 * while the old credentials were in someone else's hands.
 */

const PASSWORD = 'first-password-123'
const URL = 'http://localhost/link'

const mail = {
  sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
  sendVerificationEmail: vi.fn(() => Promise.resolve()),
  sendEmailChangeConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendEmailChangeNoticeEmail: vi.fn(() => Promise.resolve()),
  sendSignupNotificationEmail: vi.fn(() => Promise.resolve()),
  sendEmailAlreadyRegisteredEmail: vi.fn(() => Promise.resolve()),
  sendUsernameTakenEmail: vi.fn(() => Promise.resolve()),
} satisfies EmailService

const pending: Promise<void>[] = []
async function drain(): Promise<void> {
  while (pending.length) await pending.shift()
}

const accounts = new AccountService(
  userRepository,
  passwordResetRepository,
  emailChangeRepository,
  mail,
  { defer: work => void pending.push(work()) }
)
const auth = new AuthenticationService(userRepository)
const createdUserIds: string[] = []

function lastToken(send: { mock: { calls: unknown[][] } }): string {
  return send.mock.calls.at(-1)?.[1] as string
}

async function signedUpUser() {
  const username = `ec${randomBytes(6).toString('hex')}`
  const email = `${username}@example.test`
  accounts.register({ username, email, resetUrl: URL })
  await drain()
  await accounts.resetPassword({
    token: lastToken(mail.sendVerificationEmail),
    newPassword: PASSWORD,
  })
  const user = await userRepository.findByUsername(username)
  if (!user) throw new Error('sign-up did not create the user')
  createdUserIds.push(user.id)
  return { user, email }
}

async function pendingChange() {
  const { user, email } = await signedUpUser()
  await accounts.requestEmailChange(new AccessControl(user), {
    userId: user.id,
    email: `new-${randomBytes(6).toString('hex')}@example.test`,
    currentPassword: PASSWORD,
    currentEmail: email,
    confirmUrl: URL,
  })
  await drain()
  return {
    user,
    email,
    token: lastToken(mail.sendEmailChangeConfirmationEmail),
  }
}

afterAll(async () => {
  for (const id of createdUserIds) await userRepository.delete(id)
})

describe('a pending email change', () => {
  it('applies when nothing intervenes', async () => {
    const { token } = await pendingChange()

    expect(await accounts.confirmEmailChange(token)).toBe(true)
  })

  it('is cancelled by a password reset', async () => {
    const { email, token } = await pendingChange()

    accounts.requestPasswordReset({ email, resetUrl: URL })
    await drain()
    await accounts.resetPassword({
      token: lastToken(mail.sendPasswordResetEmail),
      newPassword: 'second-password-123',
    })

    expect(await accounts.confirmEmailChange(token)).toBe(false)
  })

  it('is cancelled by a password change', async () => {
    const { user, token } = await pendingChange()

    await auth.changePassword(new AccessControl(user), {
      userId: user.id,
      currentPassword: PASSWORD,
      newPassword: 'second-password-123',
    })

    expect(await accounts.confirmEmailChange(token)).toBe(false)
  })
})
