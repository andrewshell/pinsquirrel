// Simple structured logging utility for server-side code
// Provides a drop-in replacement for console methods with structured output

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
}

class Logger {
  private readonly isDevelopment = process.env.NODE_ENV !== 'production'
  private readonly logLevel: LogLevel

  constructor() {
    this.logLevel =
      (process.env.LOG_LEVEL as LogLevel) ||
      (this.isDevelopment ? 'debug' : 'info')
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && Object.keys(context).length > 0 && { context }),
    }
  }

  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Pretty print for development
      const color = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m', // green
        warn: '\x1b[33m', // yellow
        error: '\x1b[31m', // red
      }[entry.level]
      const reset = '\x1b[0m'

      console.log(
        `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} - ${entry.message}`
      )
      if (entry.context) {
        console.log(JSON.stringify(entry.context, null, 2))
      }
    } else {
      // JSON output for production
      console.log(JSON.stringify(entry))
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      this.output(this.formatEntry('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      this.output(this.formatEntry('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      this.output(this.formatEntry('warn', message, context))
    }
  }

  error(message: string, context?: LogContext): void {
    if (this.shouldLog('error')) {
      this.output(this.formatEntry('error', message, context))
    }
  }

  // Helper for logging HTTP requests
  request(request: Request, context?: LogContext): void {
    const url = new URL(request.url)
    this.info('HTTP Request', {
      method: request.method,
      path: url.pathname,
      ...context,
    })
  }

  // Helper for logging errors with stack traces
  exception(error: unknown, message: string, context?: LogContext): void {
    const errorDetails: LogContext = {
      ...context,
    }

    if (error instanceof Error) {
      errorDetails.errorName = error.name
      errorDetails.errorMessage = error.message
      if (this.isDevelopment && error.stack) {
        errorDetails.stack = error.stack.split('\n')
      }
    } else {
      errorDetails.error = String(error)
    }

    this.error(message, errorDetails)
  }
}

// Export singleton instance
export const logger = new Logger()
