import { describe, expect, it } from 'vitest'
import { createPkcePair, pkceChallengeFor } from './pkce.ts'

describe('pkceChallengeFor', () => {
  // RFC 7636 Appendix B, the worked example the spec publishes.
  it('hashes the RFC 7636 example verifier to the example challenge', async () => {
    const challenge = await pkceChallengeFor(
      'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    )

    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})

describe('createPkcePair', () => {
  // RFC 7636 4.1: 43-128 characters from the unreserved set.
  it('generates a verifier the server will accept', async () => {
    const { verifier } = await createPkcePair()

    expect(verifier.length).toBeGreaterThanOrEqual(43)
    expect(verifier.length).toBeLessThanOrEqual(128)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('pairs the verifier with its own S256 challenge', async () => {
    const { verifier, challenge } = await createPkcePair()

    expect(challenge).toBe(await pkceChallengeFor(verifier))
  })

  it('generates a different verifier every time', async () => {
    const one = await createPkcePair()
    const other = await createPkcePair()

    expect(one.verifier).not.toBe(other.verifier)
  })
})
