import { ValidationError } from '@pinsquirrel/domain'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { validationErrorFromZod } from './zod-error.js'

const schema = z.object({
  name: z
    .string()
    .min(3, 'too short')
    .regex(/^[a-z]+$/, 'letters only'),
  nested: z.object({ count: z.number().min(1, 'too small') }),
})

function parseFailure(input: unknown) {
  const result = schema.safeParse(input)
  if (result.success) {
    throw new Error('expected the parse to fail')
  }
  return result.error
}

describe('validationErrorFromZod', () => {
  it('groups every issue under its dotted path', () => {
    const error = validationErrorFromZod(
      parseFailure({ name: 'A!', nested: { count: 0 } })
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error.fields).toEqual({
      name: ['too short', 'letters only'],
      'nested.count': ['too small'],
    })
  })

  it('files pathless issues under the fallback field', () => {
    const bare = z.string().min(3, 'too short').safeParse('a')
    if (bare.success) throw new Error('expected the parse to fail')

    const error = validationErrorFromZod(bare.error, { fallbackField: 'name' })

    expect(error.fields).toEqual({ name: ['too short'] })
  })

  it('uses the supplied message instead of the first field error', () => {
    const error = validationErrorFromZod(
      parseFailure({ name: 'A!', nested: { count: 0 } }),
      { message: 'Invalid tag data' }
    )

    expect(error.message).toBe('Invalid tag data')
  })
})
