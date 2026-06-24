import { describe, it, expect } from 'vitest'
import { parseConfig, getEnvironment } from './config.js'

const env = {
  name: 'dev',
  label: 'Development',
  databaseUrl: 'mysql://localhost:3306/pinsquirrel',
  privateKeyPath: './keys/dev.json',
  mailgun: {
    apiKey: 'key-x',
    domain: 'mg.example.com',
    fromEmail: 'noreply@example.com',
    fromName: 'PinSquirrel',
  },
}
const valid = JSON.stringify({ sessionSecret: 'a-secret', environments: [env] })

describe('parseConfig', () => {
  it('parses a valid config', () => {
    const cfg = parseConfig(valid)
    expect(cfg.sessionSecret).toBe('a-secret')
    expect(cfg.environments).toHaveLength(1)
    expect(cfg.environments[0].name).toBe('dev')
    expect(cfg.environments[0].mailgun.domain).toBe('mg.example.com')
  })

  it('defaults the label to the name when omitted', () => {
    const noLabel = JSON.stringify({
      sessionSecret: 's',
      environments: [{ ...env, label: undefined }],
    })
    expect(parseConfig(noLabel).environments[0].label).toBe('dev')
  })

  it('rejects non-JSON', () => {
    expect(() => parseConfig('nope')).toThrow('Invalid admin config')
  })

  it('rejects a missing sessionSecret', () => {
    const bad = JSON.stringify({ environments: [env] })
    expect(() => parseConfig(bad)).toThrow('Invalid admin config')
  })

  it('rejects an empty environments array', () => {
    const bad = JSON.stringify({ sessionSecret: 's', environments: [] })
    expect(() => parseConfig(bad)).toThrow('Invalid admin config')
  })

  it('rejects an environment missing required fields', () => {
    const bad = JSON.stringify({
      sessionSecret: 's',
      environments: [{ name: 'dev' }],
    })
    expect(() => parseConfig(bad)).toThrow('Invalid admin config')
  })

  it('rejects an environment with incomplete mailgun settings', () => {
    const bad = JSON.stringify({
      sessionSecret: 's',
      environments: [{ ...env, mailgun: { apiKey: 'k' } }],
    })
    expect(() => parseConfig(bad)).toThrow('Invalid admin config')
  })

  it('rejects duplicate environment names', () => {
    const dup = JSON.stringify({ sessionSecret: 's', environments: [env, env] })
    expect(() => parseConfig(dup)).toThrow('Invalid admin config')
  })
})

describe('getEnvironment', () => {
  it('returns the named environment', () => {
    const cfg = parseConfig(valid)
    expect(getEnvironment(cfg, 'dev').label).toBe('Development')
  })

  it('throws for an unknown environment', () => {
    const cfg = parseConfig(valid)
    expect(() => getEnvironment(cfg, 'nope')).toThrow()
  })
})
