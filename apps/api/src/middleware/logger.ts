import pino from 'pino'
import { logger } from 'hono/logger'

export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        }
      : undefined,
})

export const requestLogger = logger((str, ...rest) => {
  pinoLogger.info(str, ...rest)
})
