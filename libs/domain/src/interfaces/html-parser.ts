export interface MetadataResult {
  title?: string
  description?: string
}

export interface HtmlParser {
  parseMetadata(html: string): MetadataResult
}
