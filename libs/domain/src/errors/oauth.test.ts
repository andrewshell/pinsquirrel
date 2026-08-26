import { describe, it, expect } from 'vitest'
import {
  OAuthError,
  OAuthInvalidRequestError,
  OAuthInvalidClientError,
  OAuthInvalidGrantError,
  OAuthUnauthorizedClientError,
  OAuthUnsupportedGrantTypeError,
  OAuthInvalidScopeError,
  OAuthInvalidTargetError,
  OAuthAccessDeniedError,
  OAuthInvalidClientMetadataError,
} from './oauth.js'

describe('OAuth errors', () => {
  // The `code` is the wire value: it is what /oauth/token and
  // /oauth/authorize put in the `error` field, and what a client keys its
  // recovery on. Claude re-runs consent on `invalid_grant` and gives up on
  // anything it does not recognise, so these strings are the contract.
  const cases: [new (message?: string) => OAuthError, string][] = [
    [OAuthInvalidRequestError, 'invalid_request'],
    [OAuthInvalidClientError, 'invalid_client'],
    [OAuthInvalidGrantError, 'invalid_grant'],
    [OAuthUnauthorizedClientError, 'unauthorized_client'],
    [OAuthUnsupportedGrantTypeError, 'unsupported_grant_type'],
    [OAuthInvalidScopeError, 'invalid_scope'],
    [OAuthInvalidTargetError, 'invalid_target'],
    [OAuthAccessDeniedError, 'access_denied'],
    [OAuthInvalidClientMetadataError, 'invalid_client_metadata'],
  ]

  it.each(cases)('%p carries the RFC code %s', (ErrorClass, code) => {
    const error = new ErrorClass()

    expect(error.code).toBe(code)
    expect(error).toBeInstanceOf(OAuthError)
    expect(error).toBeInstanceOf(Error)
  })

  it.each(cases)('%p names itself for logs', ErrorClass => {
    const error = new ErrorClass()

    expect(error.name).toBe(ErrorClass.name)
  })

  it('has a default description per code and accepts a specific one', () => {
    expect(new OAuthInvalidGrantError().message).not.toBe('')
    expect(
      new OAuthInvalidGrantError('Authorization code already used').message
    ).toBe('Authorization code already used')
  })
})
