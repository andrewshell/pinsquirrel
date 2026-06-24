import Mailgun from 'mailgun.js'
import type { MailgunSettings } from './config.js'

export interface SendResult {
  recipient: string
  ok: boolean
  error?: string
}

// Abort a stuck request rather than relying on Mailgun's default (0 = none).
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const RETRY_BASE_MS = 500

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry only on likely-transient failures: network/timeout errors (no status),
 * rate limiting (429), or server errors (5xx). Client errors (4xx) fail fast.
 */
export function isTransient(error: unknown): boolean {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined
  if (status === undefined) return true // no status => network/timeout
  if (status === 429) return true
  return typeof status === 'number' && status >= 500
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function withRetry(send: () => Promise<unknown>): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await send()
      return
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isTransient(error)) throw error
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))
    }
  }
}

/**
 * Send a plain-text message to each recipient individually (one Mailgun message
 * per address, so recipients never see each other and one failure doesn't block
 * the rest). Transient failures are retried with backoff. Returns a
 * per-recipient result.
 */
export async function sendBulk(
  settings: MailgunSettings,
  recipients: string[],
  subject: string,
  body: string
): Promise<SendResult[]> {
  const mailgun = new Mailgun(FormData)
  const client = mailgun.client({
    username: 'api',
    key: settings.apiKey,
    timeout: REQUEST_TIMEOUT_MS,
  })
  const from = settings.fromName
    ? `${settings.fromName} <${settings.fromEmail}>`
    : settings.fromEmail

  const results: SendResult[] = []
  for (const recipient of recipients) {
    try {
      await withRetry(() =>
        client.messages.create(settings.domain, {
          from,
          to: [recipient],
          subject,
          text: body,
        })
      )
      results.push({ recipient, ok: true })
    } catch (error) {
      results.push({ recipient, ok: false, error: errorMessage(error) })
    }
  }
  return results
}
