import { describe, it, expect } from 'vitest'
import {
  createPasswordResetEmailTemplate,
  createSignupNotificationEmailTemplate,
  createEmailAlreadyRegisteredTemplate,
  createUsernameTakenTemplate,
} from './templates.js'

// A value carrying every character that changes meaning in an HTML body or
// inside a quoted attribute. `resetUrl`/`signinUrl`/`signupUrl` are built from
// the request origin, so none of these is a trusted constant.
const HOSTILE = '"><script>alert(1)</script>'

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
    const { html } = createEmailAlreadyRegisteredTemplate(HOSTILE)

    expect(html).not.toContain('<script>')
    expect(html).toContain('href="&quot;&gt;&lt;script&gt;')
  })

  it('leaves the plain-text body alone', () => {
    const { text } = createEmailAlreadyRegisteredTemplate(HOSTILE)

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
