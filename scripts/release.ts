/**
 * Whether the image needs pushing is read from the registry, not from the
 * commit, so running it again after a failure pushes only what is missing. An
 * image is pushed only from a checkout whose HEAD has the version's release
 * tag in its history and is unchanged since that tag, outside the paths the
 * release does not cover, so what reaches the registry is what was released.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const IMAGE = 'ghcr.io/andrewshell/pinsquirrel'
const BRANCH = 'main'
const DOCKER_SCRIPT = 'scripts/docker-build-push.sh'
const GATE = 'quality'
// An extension release rewrites the manifest without touching the image.
const MANIFEST = '.release-please-manifest.json'

interface Release {
  readonly version: string
  readonly tag: string
  readonly ref: string
  readonly pathsOutsideRelease: readonly string[]
}

type TagState = 'released' | 'missing' | 'not-in-history' | 'changed'

interface ReleasePleaseConfig {
  packages: Record<string, { 'exclude-paths'?: string[] }>
}

const readJson = (file: string): unknown =>
  JSON.parse(fs.readFileSync(file, 'utf8'))

function readRelease(root: string): Release {
  const { version } = readJson(path.join(root, 'package.json')) as {
    version: string
  }
  const config = readJson(
    path.join(root, 'release-please-config.json')
  ) as ReleasePleaseConfig
  return {
    version,
    tag: `v${version}`,
    ref: `${IMAGE}:${version}`,
    pathsOutsideRelease: [
      ...(config.packages['.']?.['exclude-paths'] ?? []),
      MANIFEST,
    ],
  }
}

class ReleaseError extends Error {}

function fail(message: string): never {
  throw new ReleaseError(message)
}

function log(message: string): void {
  console.log(`\x1b[1m==> ${message}\x1b[0m`)
}

interface Captured {
  ok: boolean
  stdout: string
  stderr: string
}

function capture(command: string, args: readonly string[]): Captured {
  const result = spawnSync(command, args, { encoding: 'utf8' })
  if (result.error !== undefined)
    fail(`could not run ${command}: ${result.error.message}`)
  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

function step(command: string, args: readonly string[]): boolean {
  return spawnSync(command, args, { stdio: 'inherit' }).status === 0
}

const git = (...args: string[]): Captured => capture('git', args)

function imageExists(ref: string): boolean {
  const found = capture('docker', ['manifest', 'inspect', ref])
  if (found.ok) return true
  if (/manifest unknown|no such manifest|not found/i.test(found.stderr))
    return false
  return fail(`could not ask the registry about ${ref}:\n${found.stderr}`)
}

function tagState(release: Release): TagState {
  if (!git('rev-parse', '--quiet', '--verify', `refs/tags/${release.tag}`).ok)
    return 'missing'
  if (!git('merge-base', '--is-ancestor', release.tag, 'HEAD').ok)
    return 'not-in-history'
  const covered = [
    '.',
    ...release.pathsOutsideRelease.map(p => `:(exclude)${p}`),
  ]
  if (!git('diff', '--quiet', release.tag, 'HEAD', '--', ...covered).ok)
    return 'changed'
  return 'released'
}

function refusal(
  release: Release,
  state: Exclude<TagState, 'released'>
): string {
  switch (state) {
    case 'missing':
      return `tag ${release.tag} does not exist. Run git pull --prune --tags; if release-please did not tag the release, tag it by hand.`
    case 'not-in-history':
      return `tag ${release.tag} is not in the history of HEAD. Pull main and try again.`
    case 'changed':
      return `the repository has changed since ${release.tag}, so the image would not be what was released. Merge the next release pull request and release that.`
  }
}

function printSteps(dockerArgs: readonly string[], skipGates: boolean): void {
  const tag = dockerArgs.length > 0 ? ` ${dockerArgs.join(' ')}` : ''
  log('Dry run: nothing was checked, built or pushed')
  console.log('A real run would, stopping at the first failure:')
  console.log(`  1. Check HEAD is ${BRANCH}, clean and level with its upstream`)
  console.log(`     ${DOCKER_SCRIPT} --check-only${tag}`)
  console.log(
    skipGates
      ? '  2. Skip the quality gate (--skip-gates)'
      : `  2. Run the quality gate: pnpm ${GATE}`
  )
  console.log(`  3. ${DOCKER_SCRIPT} --skip-gates${tag}`)
}

function preflight(dockerArgs: readonly string[]): void {
  log(`Checking HEAD is ${BRANCH}, clean and level with its upstream`)
  const branch =
    git('symbolic-ref', '--quiet', '--short', 'HEAD').stdout ||
    'a detached HEAD'
  if (branch !== BRANCH) fail(`you are on ${branch}, not ${BRANCH}`)
  if (git('status', '--porcelain').stdout !== '') {
    fail(
      'the working tree is not clean; commit or stash your changes and try again'
    )
  }
  const upstream = git('rev-parse', '--abbrev-ref', '@{upstream}')
  if (!upstream.ok) fail(`${BRANCH} has no upstream to compare with`)
  if (
    git('rev-parse', 'HEAD').stdout !== git('rev-parse', '@{upstream}').stdout
  ) {
    fail(
      `${BRANCH} is not level with ${upstream.stdout}; run git pull --prune --tags and try again`
    )
  }
  if (!step('bash', [DOCKER_SCRIPT, '--check-only', ...dockerArgs])) {
    fail('the Docker preflight checks failed; nothing was pushed')
  }
}

function runGate(): void {
  log(`Quality gate: pnpm ${GATE}`)
  if (!step('pnpm', [GATE]))
    fail(`quality gate 'pnpm ${GATE}' failed; nothing was pushed`)
  if (git('status', '--porcelain').stdout !== '') {
    fail(
      'the quality gate changed files in the working tree; nothing was pushed'
    )
  }
}

interface Arguments {
  dryRun: boolean
  skipGates: boolean
  customTag: string | undefined
}

function parseArguments(argv: readonly string[]): Arguments {
  const parsed: Arguments = {
    dryRun: false,
    skipGates: false,
    customTag: undefined,
  }
  for (const arg of argv) {
    if (arg === '--dry-run') parsed.dryRun = true
    else if (arg === '--skip-gates') parsed.skipGates = true
    // pnpm passes the -- in `pnpm release -- beta` through.
    else if (arg === '--') continue
    else if (arg.startsWith('-')) fail(`unknown option: ${arg}`)
    else if (parsed.customTag !== undefined) {
      fail(
        `only one custom tag may be given (got '${parsed.customTag}' and '${arg}')`
      )
    } else parsed.customTag = arg
  }
  return parsed
}

function main(argv: readonly string[]): void {
  const { dryRun, skipGates, customTag } = parseArguments(argv)
  const dockerArgs = customTag === undefined ? [] : [customTag]
  const root = path.resolve(import.meta.dirname, '..')
  if (fs.realpathSync(process.cwd()) !== fs.realpathSync(root)) {
    fail(
      `run this from the repository root (${root}), for example with pnpm release`
    )
  }

  log('Asking the registry whether the image is released yet')
  const release = readRelease(root)
  if (imageExists(release.ref)) {
    console.log(`  ${release.ref}  skip: already in the registry`)
    if (customTag !== undefined) {
      fail(
        `a custom image tag was given, but there is no image to push for ${release.ref}`
      )
    }
    log('Nothing to release: the image is in the registry')
    return
  }
  console.log(`  ${release.ref}  push: no image for ${release.version} yet`)

  const state = tagState(release)
  if (state !== 'released')
    fail(`cannot release ${release.ref}: ${refusal(release, state)}`)
  if (dryRun) {
    printSteps(dockerArgs, skipGates)
    return
  }

  preflight(dockerArgs)
  if (skipGates) log('Skipping the quality gate (--skip-gates)')
  else runGate()

  if (!step('bash', [DOCKER_SCRIPT, '--skip-gates', ...dockerArgs])) {
    fail(
      [
        'The image build and push failed.',
        'Fix what went wrong, then finish the release with:',
        `  pnpm docker:build-push -- --skip-gates${customTag === undefined ? '' : ` ${customTag}`}`,
      ].join('\n')
    )
  }
  log('Released')
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error
    console.error(`\x1b[31merror:\x1b[0m ${error.message}`)
    process.exit(1)
  }
}
