import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Type for log entries
interface LogEntry {
  timestamp: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, unknown>
}

// Mock console methods before importing logger
const mockConsoleLog = vi.fn()
const originalConsoleLog = console.log
const originalEnv = process.env

beforeEach(() => {
  console.log = mockConsoleLog
  mockConsoleLog.mockClear()
  // Reset environment
  process.env = { ...originalEnv }
})

afterEach(() => {
  console.log = originalConsoleLog
  process.env = originalEnv
  // Clear module cache to ensure fresh logger instances
  vi.resetModules()
})

describe('Logger', () => {
  describe('log levels', () => {
    it('respects log level hierarchy', async () => {
      process.env.LOG_LEVEL = 'warn'
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      logger.debug('debug message')
      logger.info('info message')
      logger.warn('warn message')
      logger.error('error message')

      expect(mockConsoleLog).toHaveBeenCalledTimes(2)

      // Check warn was logged
      const warnLog = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry
      expect(warnLog.level).toBe('warn')
      expect(warnLog.message).toBe('warn message')

      // Check error was logged
      const errorLog = JSON.parse(
        mockConsoleLog.mock.calls[1][0] as string
      ) as LogEntry
      expect(errorLog.level).toBe('error')
      expect(errorLog.message).toBe('error message')
    })

    it('defaults to debug level in development', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.LOG_LEVEL

      const { logger } = await import('./logger.server')

      logger.debug('debug message')

      expect(mockConsoleLog).toHaveBeenCalled()
      expect(mockConsoleLog.mock.calls[0][0]).toContain('[DEBUG]')
      expect(mockConsoleLog.mock.calls[0][0]).toContain('debug message')
    })

    it('defaults to info level in production', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.LOG_LEVEL

      const { logger } = await import('./logger.server')

      logger.debug('debug message')
      logger.info('info message')

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry
      expect(log.level).toBe('info')
    })
  })

  describe('output formatting', () => {
    it('outputs JSON in production', async () => {
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      logger.info('test message', { userId: '123', action: 'login' })

      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry & { context: { userId: string; action: string } }

      expect(log).toMatchObject({
        level: 'info',
        message: 'test message',
        context: {
          userId: '123',
          action: 'login',
        },
      })
      expect(log.timestamp).toBeDefined()
      expect(new Date(log.timestamp).toISOString()).toBe(log.timestamp)
    })

    it('outputs pretty format in development', async () => {
      process.env.NODE_ENV = 'development'

      const { logger } = await import('./logger.server')

      logger.info('test message')

      expect(mockConsoleLog).toHaveBeenCalled()
      const output = mockConsoleLog.mock.calls[0][0] as string
      expect(output).toContain('[INFO]')
      expect(output).toContain('test message')
      // Should contain color codes
      expect(output).toContain('\x1b[32m')
    })

    it('logs context in development', async () => {
      process.env.NODE_ENV = 'development'

      const { logger } = await import('./logger.server')

      logger.info('test message', { userId: '123' })

      expect(mockConsoleLog).toHaveBeenCalledTimes(2)
      expect(mockConsoleLog.mock.calls[1][0]).toBe(
        JSON.stringify({ userId: '123' }, null, 2)
      )
    })
  })

  describe('helper methods', () => {
    it('logs request details', async () => {
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      const request = new Request('http://localhost:3000/api/users?page=1', {
        method: 'GET',
      })

      logger.request(request, { userId: '123' })

      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry & {
        context: { method: string; path: string; userId: string }
      }
      expect(log).toMatchObject({
        level: 'info',
        message: 'HTTP Request',
        context: {
          method: 'GET',
          path: '/api/users',
          userId: '123',
        },
      })
    })

    it('logs exception details', async () => {
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      const error = new Error('Test error')
      error.name = 'TestError'

      logger.exception(error, 'Operation failed', { operation: 'test' })

      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry & {
        context: { operation: string; errorName: string; errorMessage: string }
      }
      expect(log).toMatchObject({
        level: 'error',
        message: 'Operation failed',
        context: {
          operation: 'test',
          errorName: 'TestError',
          errorMessage: 'Test error',
        },
      })
      expect((log.context as { stack?: unknown }).stack).toBeUndefined() // No stack in production
    })

    it('includes stack trace in development', async () => {
      process.env.NODE_ENV = 'development'

      const { logger } = await import('./logger.server')

      const error = new Error('Test error')
      logger.exception(error, 'Operation failed')

      // In development, we log twice (message + context)
      expect(mockConsoleLog).toHaveBeenCalledTimes(2)
      const contextOutput = mockConsoleLog.mock.calls[1][0] as string
      const context = JSON.parse(contextOutput) as { stack?: string[] }
      expect(context.stack).toBeDefined()
      expect(Array.isArray(context.stack)).toBe(true)
    })

    it('handles non-Error exceptions', async () => {
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      logger.exception('string error', 'Operation failed')

      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry & { context: { error: string } }
      expect(log.context.error).toBe('string error')
    })
  })

  describe('context handling', () => {
    it('omits context when empty', async () => {
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      logger.info('test message', {})

      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry
      expect(log.context).toBeUndefined()
    })

    it('includes context when provided', async () => {
      process.env.NODE_ENV = 'production'

      const { logger } = await import('./logger.server')

      logger.info('test message', { foo: 'bar', count: 42 })

      const log = JSON.parse(
        mockConsoleLog.mock.calls[0][0] as string
      ) as LogEntry & { context: { foo: string; count: number } }
      expect(log.context).toEqual({ foo: 'bar', count: 42 })
    })
  })
})
