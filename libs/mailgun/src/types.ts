export interface MailgunConfig {
  apiKey: string
  domain: string
  baseUrl?: string
  fromEmail: string
  fromName?: string
}

/** The outcome of one message in a bulk send. */
export interface SendResult {
  recipient: string
  ok: boolean
  error?: string
}
