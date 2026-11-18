import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'password',
      'newPassword',
      'confirmPassword',
      'token',
      'resetToken',
    ],
    censor: '[REDACTED]',
  },
})

/**
 * An error in a form fit to log. Drizzle appends a failed query's bound
 * values to its message (usernames, email hashes), so that tail is cut from
 * the message and from the stack that repeats it.
 */
export function safeError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) {
    const [message = ''] = err.message.split('\nparams: ')
    return { message, stack: err.stack?.replace(err.message, message) }
  }
  return { message: String(err) }
}
