import { readFileSync } from 'node:fs'

export interface MailgunSettings {
  apiKey: string
  domain: string
  fromEmail: string
  fromName?: string
}

export interface AdminEnvironment {
  name: string
  label: string
  databaseUrl: string
  privateKeyPath: string
  mailgun: MailgunSettings
}

export interface AdminConfig {
  sessionSecret: string
  environments: AdminEnvironment[]
}

function invalid(detail: string): never {
  throw new Error(`Invalid admin config: ${detail}`)
}

function requireString(
  obj: Record<string, unknown>,
  field: string,
  context: string
): string {
  const value = obj[field]
  if (typeof value !== 'string' || value.length === 0) {
    invalid(`${context} is missing or has an invalid "${field}"`)
  }
  return value
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(`${context} must be an object`)
  }
  return value as Record<string, unknown>
}

function parseMailgun(value: unknown, context: string): MailgunSettings {
  const obj = asRecord(value, `${context} mailgun`)
  const fromName = obj.fromName
  if (fromName !== undefined && typeof fromName !== 'string') {
    invalid(`${context} mailgun has an invalid "fromName"`)
  }
  return {
    apiKey: requireString(obj, 'apiKey', `${context} mailgun`),
    domain: requireString(obj, 'domain', `${context} mailgun`),
    fromEmail: requireString(obj, 'fromEmail', `${context} mailgun`),
    fromName,
  }
}

function parseEnvironment(value: unknown, index: number): AdminEnvironment {
  const context = `environment[${index}]`
  const obj = asRecord(value, context)
  const name = requireString(obj, 'name', context)
  const label =
    typeof obj.label === 'string' && obj.label.length > 0 ? obj.label : name
  return {
    name,
    label,
    databaseUrl: requireString(obj, 'databaseUrl', context),
    privateKeyPath: requireString(obj, 'privateKeyPath', context),
    mailgun: parseMailgun(obj.mailgun, context),
  }
}

export function parseConfig(contents: string): AdminConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    invalid('not valid JSON')
  }
  const obj = asRecord(parsed, 'config')
  const sessionSecret = requireString(obj, 'sessionSecret', 'config')

  if (!Array.isArray(obj.environments) || obj.environments.length === 0) {
    invalid('"environments" must be a non-empty array')
  }
  const environments = obj.environments.map((e, i) => parseEnvironment(e, i))

  const names = new Set<string>()
  for (const e of environments) {
    if (names.has(e.name)) {
      invalid(`duplicate environment name "${e.name}"`)
    }
    names.add(e.name)
  }

  return { sessionSecret, environments }
}

export function getEnvironment(
  config: AdminConfig,
  name: string
): AdminEnvironment {
  const env = config.environments.find(e => e.name === name)
  if (!env) {
    throw new Error(`Unknown environment "${name}"`)
  }
  return env
}

/** Read and parse the admin config file (default ./admin.config.json). */
export function loadConfig(
  path: string = process.env.ADMIN_CONFIG ?? './admin.config.json'
): AdminConfig {
  let contents: string
  try {
    contents = readFileSync(path, 'utf8')
  } catch (error) {
    throw new Error(
      `Could not read admin config at ${path}. Copy admin.config.example.json to admin.config.json.`,
      { cause: error }
    )
  }
  return parseConfig(contents)
}
