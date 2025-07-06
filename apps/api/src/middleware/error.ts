import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof HTTPException) {
    return err.getResponse()
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation Error',
        details: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      400
    )
  }

  console.error('Unexpected error:', err)

  return c.json(
    {
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong',
    },
    500
  )
}
