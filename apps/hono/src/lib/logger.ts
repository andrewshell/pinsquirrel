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
 * Flat, so that pino's `err` serializer, which folds an error-shaped `cause`
 * into the message and drops its fields, keeps every one of these.
 */
interface LoggedError {
  message: string
  stack?: string
  /** The driver's code and number, such as mysql2's `ER_LOCK_DEADLOCK` and 1213. */
  code?: string
  errno?: number
  /** The messages of the errors behind this one, outermost first. */
  cause?: string
}

const MAX_CAUSE_DEPTH = 3

/**
 * An error in a form fit to log, with what caused it, which for a failed
 * query is the MySQL error that says why.
 *
 * Drizzle appends a failed query's bound values to its message (usernames,
 * email hashes), so that tail is cut from the message and from the stack that
 * repeats it. MySQL repeats the offending value in a duplicate-key or
 * bad-value message, so that value is cut too.
 */
export function safeError(err: unknown): LoggedError {
  if (!(err instanceof Error)) return { message: String(err) }

  const message = redact(err.message)
  const logged: LoggedError = {
    message,
    stack: err.stack?.replace(err.message, message),
  }

  const causes: string[] = []
  let current: unknown = err
  for (let depth = 0; current instanceof Error; depth++) {
    const { code, errno } = current as { code?: unknown; errno?: unknown }
    if (logged.code === undefined && typeof code === 'string') {
      logged.code = code
      if (typeof errno === 'number') logged.errno = errno
    }
    if (depth > 0) causes.push(redact(current.message))
    if (depth === MAX_CAUSE_DEPTH) break
    current = current.cause
  }
  if (causes.length > 0) logged.cause = causes.join(': ')
  return logged
}

function redact(message: string): string {
  const [unbound = ''] = message.split('\nparams: ')
  return unbound.replace(
    /(Duplicate entry|value:) '.*' for (key|column) /s,
    '$1 [REDACTED] for $2 '
  )
}
