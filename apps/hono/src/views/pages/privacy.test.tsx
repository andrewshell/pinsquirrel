import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import type {
  EmailService,
  PasswordResetRepository,
  User,
  UserRepository,
} from '@pinsquirrel/domain'
import { Role, UserStatus } from '@pinsquirrel/domain'
import { AccountService } from '@pinsquirrel/services'
import { PrivacyPage } from './privacy'

async function privacyPageText(): Promise<string> {
  const app = new Hono()
  app.get('/privacy', c => c.html(<PrivacyPage user={null} />))
  const html = await (await app.request('/privacy')).text()
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
}

/** Every argument sign-up passes to the operator notification, as one string. */
async function whatSignupTellsTheOperator(address: string): Promise<string> {
  const created: User = {
    id: 'new-user',
    username: 'newperson',
    passwordHash: null,
    emailHash: 'h',
    emailEncrypted: null,
    roles: [Role.User],
    status: UserStatus.Unverified,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const users = {
    findByEmailHash: vi.fn().mockResolvedValue(null),
    findByUsername: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(created),
  } as unknown as UserRepository
  const email = {
    sendSignupNotificationEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailService
  const pending: Promise<void>[] = []

  new AccountService(
    users,
    {} as PasswordResetRepository,
    { save: vi.fn(), consume: vi.fn() },
    email,
    { defer: work => void pending.push(work()) }
  ).register({
    username: 'newperson',
    email: address,
    notifyEmail: 'operator@example.test',
  })
  while (pending.length > 0) await Promise.all(pending.splice(0))

  return JSON.stringify(vi.mocked(email.sendSignupNotificationEmail).mock.calls)
}

describe('PrivacyPage', () => {
  it('does not promise an unrecoverable email while sign-up sends the address to the operator', async () => {
    const page = await privacyPageText()
    const pageClaimsUnrecoverable =
      /even we can.?t figure out what it was/i.test(page) ||
      /beyond recognition/i.test(page)

    const address = 'private-person@example.test'
    const operatorGetsAddress = (
      await whatSignupTellsTheOperator(address)
    ).includes(address)

    expect(operatorGetsAddress).toBe(true)
    expect(pageClaimsUnrecoverable).toBe(false)
  })

  it('says what is kept and that the operator hears of each sign-up', async () => {
    const page = await privacyPageText()

    expect(page).toMatch(/hash/i)
    expect(page).toMatch(/sealed|encrypted/i)
    expect(page).toMatch(/operator gets an email/i)
  })
})
