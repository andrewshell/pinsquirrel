/** How a fetch should behave, where the default is not what a caller wants. */
export interface HttpFetchOptions {
  /**
   * `error` refuses a redirect instead of following it.
   *
   * The default (`follow`) is right for page metadata, where a redirect is
   * ordinary and every hop is re-checked against the blocked address ranges.
   * It is wrong for a document a client publishes at an identifier it chose,
   * such as a CIMD document: there the redirect is a misconfiguration, and
   * chasing it widens what a caller-supplied URL can reach.
   */
  redirect?: 'follow' | 'error'
}

export interface HttpFetcher {
  fetch(url: string, options?: HttpFetchOptions): Promise<string>
}
