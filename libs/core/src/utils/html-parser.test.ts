import { describe, it, expect } from 'vitest'
import { CheerioHtmlParser } from './html-parser'

describe('CheerioHtmlParser', () => {
  let parser: CheerioHtmlParser

  beforeEach(() => {
    parser = new CheerioHtmlParser()
  })

  it('should extract title and description', () => {
    const html = `
      <html>
        <head>
          <title>   Test Page Title   </title>
          <meta name="description" content="   Test description   ">
        </head>
      </html>
    `

    const result = parser.parseMetadata(html)

    expect(result).toEqual({
      title: 'Test Page Title',
      description: 'Test description',
    })
  })

  it('should handle missing title', () => {
    const html = `
      <html>
        <head>
          <meta name="description" content="Test description">
        </head>
      </html>
    `

    const result = parser.parseMetadata(html)

    expect(result).toEqual({
      description: 'Test description',
    })
  })

  it('should handle missing description', () => {
    const html = `
      <html>
        <head>
          <title>Test Title</title>
        </head>
      </html>
    `

    const result = parser.parseMetadata(html)

    expect(result).toEqual({
      title: 'Test Title',
    })
  })

  it('should return empty object when no metadata found', () => {
    const html = '<html><head></head></html>'

    const result = parser.parseMetadata(html)

    expect(result).toEqual({})
  })

  it('should trim whitespace from title and description', () => {
    const html = `
      <html>
        <head>
          <title>   Title with spaces   </title>
          <meta name="description" content="   Description with spaces   ">
        </head>
      </html>
    `

    const result = parser.parseMetadata(html)

    expect(result).toEqual({
      title: 'Title with spaces',
      description: 'Description with spaces',
    })
  })
})
