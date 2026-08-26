/**
 * PKCE (RFC 7636), the half of the authorization-code flow that stands in for
 * a client secret.
 *
 * `crypto.getRandomValues` and `crypto.subtle` are both on the global in an MV3
 * service worker and in the popup, so nothing here needs a polyfill or a
 * bundled hash implementation.
 */

/** base64url per RFC 4648 5: the URL alphabet, no padding. */
function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * 32 random bytes, which base64url encodes to 43 characters - the shortest
 * verifier RFC 7636 4.1 allows and the length it recommends.
 */
const VERIFIER_BYTES = 32

/** A PKCE verifier and the challenge that stands for it in a redirect. */
export interface PkcePair {
  /** Held by the extension until the token exchange proves it started the flow. */
  verifier: string
  /** Sent on the authorization request, where a redirect could expose it. */
  challenge: string
}

/**
 * The `S256` challenge for a verifier: base64url of its SHA-256 digest.
 *
 * `plain` is not implemented. OAuth 2.1 forbids it and the server's metadata
 * advertises `S256` only, so there is nothing to fall back to.
 */
export async function pkceChallengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )
  return base64url(new Uint8Array(digest))
}

/** A fresh verifier and its challenge, one pair per authorization request. */
export async function createPkcePair(): Promise<PkcePair> {
  const verifier = base64url(
    crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES))
  )
  return { verifier, challenge: await pkceChallengeFor(verifier) }
}

/**
 * A random URL-safe token, for the values that only have to be unguessable
 * rather than PKCE-shaped - `state` on an authorization request.
 */
export function randomUrlSafeToken(bytes = VERIFIER_BYTES): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}
