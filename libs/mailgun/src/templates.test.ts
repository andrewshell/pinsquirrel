import { describe, it, expect } from 'vitest'
import {
  createPasswordResetEmailTemplate,
  createVerificationEmailTemplate,
  createEmailChangeConfirmationTemplate,
  createSignupNotificationEmailTemplate,
  createEmailAlreadyRegisteredTemplate,
  createUsernameTakenTemplate,
  createAccessGrantedTemplate,
} from './templates.js'

// A value carrying every character that changes meaning in an HTML body or
// inside a quoted attribute. `resetUrl`/`signinUrl`/`signupUrl` are built from
// the request origin, so none of these is a trusted constant.
const HOSTILE = '"><script>alert(1)</script>'

describe('createVerificationEmailTemplate', () => {
  it('asks a new user to confirm, not to reset, and gives the 48-hour lifetime', () => {
    const { html, text } = createVerificationEmailTemplate('https://x.test/v')

    for (const body of [html, text]) {
      expect(body).toContain('Confirm')
      expect(body).toContain('48 hours')
      expect(body).not.toMatch(/reset your password/i)
    }
  })

  it('escapes the link in the HTML body', () => {
    const { html } = createVerificationEmailTemplate(HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
  })
})

describe('createEmailChangeConfirmationTemplate', () => {
  it('escapes the link in the HTML body', () => {
    const { html, text } = createEmailChangeConfirmationTemplate(HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
    expect(text).toContain(HOSTILE)
  })
})

describe('createPasswordResetEmailTemplate', () => {
  it('escapes the reset URL in both the href and the visible copy', () => {
    const { html } = createPasswordResetEmailTemplate(HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
  })

  it('leaves the plain-text body alone', () => {
    const { text } = createPasswordResetEmailTemplate(HOSTILE)

    expect(text).toContain(HOSTILE)
  })
})

describe('createSignupNotificationEmailTemplate', () => {
  it('escapes the username and email in the HTML body', () => {
    const { html } = createSignupNotificationEmailTemplate(
      HOSTILE,
      `evil${HOSTILE}@example.com`
    )

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('</script>')
    expect(html).toContain('Yay! &quot;&gt;&lt;script&gt;')
    expect(html).toContain(
      '<strong>Email:</strong> evil&quot;&gt;&lt;script&gt;'
    )
  })

  it('leaves the plain-text body alone', () => {
    const { text } = createSignupNotificationEmailTemplate(
      HOSTILE,
      'user@example.com'
    )

    expect(text).toContain(`Yay! ${HOSTILE} just signed up`)
    expect(text).toContain(`Username: ${HOSTILE}`)
  })
})

describe('createEmailAlreadyRegisteredTemplate', () => {
  it('escapes the sign-in URL in the href', () => {
    const { html } = createEmailAlreadyRegisteredTemplate(HOSTILE, HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
  })

  it('leaves the plain-text body alone', () => {
    const { text } = createEmailAlreadyRegisteredTemplate(HOSTILE, HOSTILE)

    expect(text).toContain(`Sign in: ${HOSTILE}`)
  })
})

describe('createUsernameTakenTemplate', () => {
  it('escapes the username and the sign-up URL', () => {
    const { html } = createUsernameTakenTemplate(HOSTILE, HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('<strong>&quot;&gt;&lt;script&gt;')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
  })

  it('leaves the plain-text body alone', () => {
    const { text } = createUsernameTakenTemplate(HOSTILE, HOSTILE)

    expect(text).toContain(`"${HOSTILE}" is already taken`)
    expect(text).toContain(`Sign up: ${HOSTILE}`)
  })
})

describe('createAccessGrantedTemplate', () => {
  it('escapes the username and the sign-in URL', () => {
    const { html } = createAccessGrantedTemplate(HOSTILE, HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('Hi &quot;&gt;&lt;script&gt;')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
  })

  it('leaves the plain-text body alone', () => {
    const { text } = createAccessGrantedTemplate(HOSTILE, HOSTILE)

    expect(text).toContain(`Hi ${HOSTILE},`)
    expect(text).toContain(`Sign in: ${HOSTILE}`)
  })
})
