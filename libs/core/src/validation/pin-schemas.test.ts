import { describe, it, expect } from 'vitest'
import {
  urlSchema,
  pinTitleSchema,
  pinDescriptionSchema,
  tagNameSchema,
  createPinDataSchema,
  updatePinDataSchema,
  createTagDataSchema,
  updateTagDataSchema,
} from './pin-schemas.js'

describe('urlSchema', () => {
  it('should accept valid URLs', () => {
    const validUrls = [
      'https://example.com',
      'http://localhost:3000',
      'https://sub.domain.com/path/to/page',
      'https://example.com/path?query=value#hash',
    ]

    validUrls.forEach(url => {
      const result = urlSchema.safeParse(url)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid URLs', () => {
    const invalidUrls = ['not-a-url', 'example.com', 'ftp://']

    invalidUrls.forEach(url => {
      const result = urlSchema.safeParse(url)
      expect(result.success).toBe(false)
    })
  })

  it('should reject URLs longer than 2048 characters', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2030)
    const result = urlSchema.safeParse(longUrl)
    expect(result.success).toBe(false)
  })
})

describe('pinTitleSchema', () => {
  it('should accept valid titles', () => {
    const validTitles = ['A', 'My Article', 'a'.repeat(200)]

    validTitles.forEach(title => {
      const result = pinTitleSchema.safeParse(title)
      expect(result.success).toBe(true)
    })
  })

  it('should reject empty titles', () => {
    const result = pinTitleSchema.safeParse('')
    expect(result.success).toBe(false)
  })

  it('should reject titles longer than 200 characters', () => {
    const result = pinTitleSchema.safeParse('a'.repeat(201))
    expect(result.success).toBe(false)
  })
})

describe('pinDescriptionSchema', () => {
  it('should accept valid descriptions', () => {
    const validDescriptions = [
      'Short description',
      'a'.repeat(1000),
      null,
      undefined,
    ]

    validDescriptions.forEach(desc => {
      const result = pinDescriptionSchema.safeParse(desc)
      expect(result.success).toBe(true)
    })
  })

  it('should reject descriptions longer than 1000 characters', () => {
    const result = pinDescriptionSchema.safeParse('a'.repeat(1001))
    expect(result.success).toBe(false)
  })
})

describe('tagNameSchema', () => {
  it('should accept valid tag names', () => {
    const validNames = [
      'javascript',
      'web-development',
      'React',
      'node123',
      'AI-ML',
    ]

    validNames.forEach(name => {
      const result = tagNameSchema.safeParse(name)
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid tag names', () => {
    const invalidNames = [
      '',
      'tag with spaces',
      'tag_with_underscore',
      'tag@special',
      'a'.repeat(51),
    ]

    invalidNames.forEach(name => {
      const result = tagNameSchema.safeParse(name)
      expect(result.success).toBe(false)
    })
  })

  it('should transform tag names to lowercase', () => {
    const testCases = [
      { input: 'JavaScript', expected: 'javascript' },
      { input: 'Web-Development', expected: 'web-development' },
      { input: 'REACT', expected: 'react' },
      { input: 'AI-ML', expected: 'ai-ml' },
      { input: 'node123', expected: 'node123' },
    ]

    testCases.forEach(({ input, expected }) => {
      const result = tagNameSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(expected)
      }
    })
  })
})

describe('createPinDataSchema', () => {
  it('should accept valid pin creation data', () => {
    const validData = {
      url: 'https://example.com',
      title: 'Example Article',
      description: 'This is a description',
      readLater: true,
      tagNames: ['javascript', 'web-development'],
    }

    const result = createPinDataSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should accept minimal valid data', () => {
    const minimalData = {
      url: 'https://example.com',
      title: 'Example',
    }

    const result = createPinDataSchema.safeParse(minimalData)
    expect(result.success).toBe(true)
    expect(result.data?.readLater).toBe(false) // default value
  })

  it('should reject invalid data', () => {
    const invalidData = {
      url: 'not-a-url',
      title: '',
    }

    const result = createPinDataSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('updatePinDataSchema', () => {
  it('should accept valid update data', () => {
    const validData = {
      url: 'https://updated.com',
      title: 'Updated Title',
      description: null,
      readLater: false,
    }

    const result = updatePinDataSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should accept empty update data', () => {
    const result = updatePinDataSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should accept partial update data', () => {
    const partialData = {
      title: 'New Title',
    }

    const result = updatePinDataSchema.safeParse(partialData)
    expect(result.success).toBe(true)
  })
})

describe('createTagDataSchema', () => {
  it('should accept valid tag creation data', () => {
    const validData = {
      name: 'javascript',
    }

    const result = createTagDataSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject invalid tag names', () => {
    const invalidData = {
      name: 'invalid tag name',
    }

    const result = createTagDataSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
  })
})

describe('updateTagDataSchema', () => {
  it('should accept valid tag update data', () => {
    const validData = {
      name: 'typescript',
    }

    const result = updateTagDataSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should accept empty update data', () => {
    const result = updateTagDataSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})
