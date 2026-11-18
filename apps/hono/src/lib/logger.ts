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
  code?: string
  errno?: number
  cause?: string
}

const MAX_CAUSE_DEPTH = 3

/**
 * Drizzle appends a failed query's bound values to its message (usernames,
 * email hashes), so that tail is cut from the message and from the stack that
 * repeats it. MySQL quotes the value it rejected, so everything quoted is cut
 * as well, from the first quote to the last, except the key or column named
 * at the end. A value holding a quote of its own is cut whole that way.
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

/** The key or column MySQL names after the value it rejected. */
const NAMED_TAIL = / for (?:key|column) '[^']*'(?: at row \d+)?$/

function redact(message: string): string {
  const [unbound = ''] = message.split('\nparams: ')
  const tail = NAMED_TAIL.exec(unbound)?.[0] ?? ''
  const head = unbound.slice(0, unbound.length - tail.length)
  return head.replace(/'.*'/s, '[REDACTED]') + tail
}
