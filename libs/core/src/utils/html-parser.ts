import * as cheerio from 'cheerio'
import type { MetadataResult } from '../services/metadata-service'

export interface HtmlParser {
  parseMetadata(html: string): MetadataResult
}

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
