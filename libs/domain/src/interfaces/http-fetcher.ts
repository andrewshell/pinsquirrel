export interface HttpFetcher {
  fetch(url: string): Promise<string>
}
