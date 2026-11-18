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

interface LoggedError {
  message: string
  stack?: string
  /** A driver's error code and number, such as mysql2's `ER_LOCK_DEADLOCK` and 1213. */
  code?: string
  errno?: number
  cause?: LoggedError
}

const MAX_CAUSE_DEPTH = 3

/**
 * An error in a form fit to log, with its cause, which for a failed query is
 * the MySQL error that says why.
 *
 * Drizzle appends a failed query's bound values to its message (usernames,
 * email hashes), so that tail is cut from the message and from the stack that
 * repeats it. MySQL repeats the offending value in a duplicate-key or
 * bad-value message, so that value is cut too.
 */
export function safeError(err: unknown): LoggedError {
  return loggedError(err, 0)
}

function loggedError(err: unknown, depth: number): LoggedError {
  if (!(err instanceof Error)) return { message: String(err) }

  const [unbound = ''] = err.message.split('\nparams: ')
  const message = unbound.replace(
    /(Duplicate entry|value:) '.*' for (key|column) /s,
    '$1 [REDACTED] for $2 '
  )
  const logged: LoggedError = {
    message,
    stack: err.stack?.replace(err.message, message),
  }

  const { code, errno } = err as { code?: unknown; errno?: unknown }
  if (typeof code === 'string') logged.code = code
  if (typeof errno === 'number') logged.errno = errno
  if (err.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    logged.cause = loggedError(err.cause, depth + 1)
  }
  return logged
}
