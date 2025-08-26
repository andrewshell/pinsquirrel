import * as cheerio from 'cheerio'
import type { HtmlParser, MetadataResult } from '@pinsquirrel/domain'

export class CheerioHtmlParser implements HtmlParser {
  parseMetadata(html: string): MetadataResult {
    const $ = cheerio.load(html)

    // Extract title
    const title = $('title').first().text().trim()

    // Extract meta description
    const description = $('meta[name="description"]').attr('content')?.trim()

    const metadata: MetadataResult = {}

    if (title) {
      metadata.title = title
    }

    if (description) {
      metadata.description = description
    }

    return metadata
  }
}
