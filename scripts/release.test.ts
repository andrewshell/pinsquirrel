import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

import { IMAGE } from './release.ts'

const SCRIPTS = import.meta.dirname
const RELEASED = '3.10.1'
const BUMPED = '3.11.0'

const scratch: string[] = []
afterAll(() => {
  for (const dir of scratch) fs.rmSync(dir, { recursive: true, force: true })
})

function temp(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  scratch.push(dir)
  return dir
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
}

const STUB = `#!/bin/sh
name=$(basename "$0")
echo "$name $*" >> "$STUB_LOG"
case "$name $1" in
  "pnpm quality") [ -z "$STUB_FAIL_GATE" ] || exit 1 ;;
  "docker manifest")
    if [ -n "$STUB_REGISTRY_ERROR" ]; then echo "$STUB_REGISTRY_ERROR" >&2; exit 1; fi
    for found in $STUB_IMAGES; do
      if [ "$found" = "$3" ]; then echo '{}'; exit 0; fi
    done
    echo "manifest unknown" >&2; exit 1 ;;
  "docker login") exit 1 ;;
  "docker buildx") [ "$2" != build ] || [ -z "$STUB_BUILD_FAILS" ] || exit 1 ;;
esac
exit 0
`

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Release Test',
  GIT_AUTHOR_EMAIL: 'release@example.test',
  GIT_COMMITTER_NAME: 'Release Test',
  GIT_COMMITTER_EMAIL: 'release@example.test',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

function git(repo: string, ...args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: repo,
    env: { ...process.env, ...GIT_ENV },
    encoding: 'utf8',
  })
  expect(result.status, `git ${args.join(' ')}: ${result.stderr}`).toBe(0)
  return result.stdout.trim()
}

function commit(repo: string, file: string, message: string): void {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
  fs.writeFileSync(path.join(repo, file), `${message}\n`)
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', message)
  git(repo, 'push', '-q')
}

function repository(version = RELEASED, tags = [`v${version}`]): string {
  const root = temp('pinsquirrel-release-')
  const repo = path.join(root, 'repo')
  fs.mkdirSync(path.join(repo, 'scripts'), { recursive: true })
  for (const file of ['release.ts', 'docker-build-push.sh']) {
    fs.copyFileSync(path.join(SCRIPTS, file), path.join(repo, 'scripts', file))
  }
  writeJson(path.join(repo, 'scripts', 'package.json'), { type: 'module' })
  fs.mkdirSync(path.join(repo, 'apps', 'hono'), { recursive: true })
  fs.writeFileSync(
    path.join(repo, 'apps', 'hono', 'Dockerfile'),
    'FROM scratch\n'
  )
  fs.writeFileSync(path.join(repo, '.gitignore'), '.stub-*\n')
  writeJson(path.join(repo, 'package.json'), { name: 'pinsquirrel', version })
  writeJson(path.join(repo, 'release-please-config.json'), {
    packages: {
      '.': { 'exclude-paths': ['apps/chrome-extension'] },
      'apps/chrome-extension': { component: 'chrome-extension' },
    },
  })
  writeJson(path.join(repo, '.release-please-manifest.json'), {
    '.': version,
    'apps/chrome-extension': '1.0.0',
  })
  writeJson(path.join(repo, 'apps', 'chrome-extension', 'package.json'), {
    version: '1.0.0',
  })

  git(repo, 'init', '-q', '-b', 'main')
  git(repo, 'add', '.')
  git(repo, 'commit', '-q', '-m', `chore(main): release ${version}`)
  for (const tag of tags) git(repo, 'tag', tag)

  const origin = path.join(root, 'origin')
  fs.mkdirSync(origin)
  git(origin, 'init', '-q', '--bare')
  git(repo, 'remote', 'add', 'origin', origin)
  git(repo, 'push', '-q', '-u', 'origin', 'main')

  const bin = path.join(repo, '.stub-bin')
  fs.mkdirSync(bin)
  for (const name of ['pnpm', 'docker']) {
    fs.writeFileSync(path.join(bin, name), STUB, { mode: 0o755 })
  }
  writeJson(path.join(repo, '.stub-home', '.docker', 'config.json'), {
    auths: { 'ghcr.io': {} },
  })
  return repo
}

interface Options {
  images?: string[]
  failGate?: boolean
  buildFails?: boolean
  registryError?: string
}

interface Run {
  status: number | null
  output: string
  calls: string[]
}

function release(
  repo: string,
  args: string[] = [],
  options: Options = {}
): Run {
  const log = path.join(repo, '.stub-log')
  fs.writeFileSync(log, '')
  const result = spawnSync(
    process.execPath,
    [path.join(repo, 'scripts', 'release.ts'), ...args],
    {
      cwd: repo,
      env: {
        ...GIT_ENV,
        PATH: `${path.join(repo, '.stub-bin')}${path.delimiter}${process.env.PATH ?? ''}`,
        HOME: path.join(repo, '.stub-home'),
        STUB_LOG: log,
        STUB_IMAGES: (options.images ?? []).join(' '),
        STUB_FAIL_GATE: options.failGate === true ? '1' : '',
        STUB_BUILD_FAILS: options.buildFails === true ? '1' : '',
        STUB_REGISTRY_ERROR: options.registryError ?? '',
      },
      encoding: 'utf8',
    }
  )
  return {
    status: result.status,
    output: result.stdout + result.stderr,
    calls: fs.readFileSync(log, 'utf8').split('\n').filter(Boolean),
  }
}

const gatesRun = (calls: string[]): string[] =>
  calls.filter(c => c === 'pnpm quality')
const builds = (calls: string[]): string[] =>
  calls.filter(c => c.startsWith('docker buildx build'))
const tagsBuilt = (calls: string[]): string[] =>
  [...(builds(calls)[0] ?? '').matchAll(/--tag (\S+)/g)].map(m => m[1] ?? '')
const index = (calls: string[], prefix: string): number =>
  calls.findIndex(c => c.startsWith(prefix))

describe('release.ts when the image is in the registry', () => {
  it('says there is nothing to release and exits 0', () => {
    const repo = repository()
    const { status, output, calls } = release(repo, [], {
      images: [`${IMAGE}:${RELEASED}`],
    })

    expect(status, output).toBe(0)
    expect(output).toMatch(/Nothing to release/)
    expect(gatesRun(calls)).toEqual([])
    expect(builds(calls)).toEqual([])
  })

  it('refuses a custom tag, since there is no image to push', () => {
    const repo = repository()
    const { status, output, calls } = release(repo, ['beta'], {
      images: [`${IMAGE}:${RELEASED}`],
    })

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/no image to push/)
    expect(builds(calls)).toEqual([])
  })
})

describe('release.ts when the registry cannot be asked', () => {
  it.each(['unauthorized: authentication required', 'denied'])(
    'stops without pushing on "%s", rather than taking it for a missing image',
    registryError => {
      const repo = repository()
      const { status, output, calls } = release(repo, [], { registryError })

      expect(status, output).not.toBe(0)
      expect(output).toMatch(/could not ask the registry/)
      expect(output).toContain(registryError)
      expect(gatesRun(calls)).toEqual([])
      expect(builds(calls)).toEqual([])
    }
  )
})

describe('release.ts real run', () => {
  it('checks Docker, runs the quality gate once, then pushes the version and latest', () => {
    const repo = repository(BUMPED)
    const { status, output, calls } = release(repo)

    expect(status, output).toBe(0)
    expect(gatesRun(calls)).toEqual(['pnpm quality'])
    expect(index(calls, 'docker info')).toBeLessThan(
      index(calls, 'pnpm quality')
    )
    expect(index(calls, 'pnpm quality')).toBeLessThan(
      index(calls, 'docker buildx build')
    )
    expect(builds(calls)).toHaveLength(1)
    expect(builds(calls)[0]).toMatch(/--platform linux\/amd64,linux\/arm64/)
    expect(builds(calls)[0]).toMatch(/--file apps\/hono\/Dockerfile/)
    expect(tagsBuilt(calls)).toEqual([`${IMAGE}:${BUMPED}`, `${IMAGE}:latest`])
  })

  it('runs no gate with --skip-gates, and passes a custom tag to the image', () => {
    const repo = repository(BUMPED)
    const { status, output, calls } = release(repo, ['--skip-gates', 'beta'])

    expect(status, output).toBe(0)
    expect(gatesRun(calls)).toEqual([])
    expect(tagsBuilt(calls)).toEqual([
      `${IMAGE}:${BUMPED}`,
      `${IMAGE}:latest`,
      `${IMAGE}:beta`,
    ])
  })

  it('releases after a later change that only touches the extension', () => {
    const repo = repository(BUMPED)
    commit(repo, 'apps/chrome-extension/later.txt', 'feat(extension): later')
    writeJson(path.join(repo, '.release-please-manifest.json'), {
      '.': BUMPED,
      'apps/chrome-extension': '1.1.0',
    })
    git(repo, 'commit', '-q', '-am', 'chore(main): release chrome-extension')
    git(repo, 'push', '-q')
    const { status, output, calls } = release(repo)

    expect(status, output).toBe(0)
    expect(builds(calls)).toHaveLength(1)
  })

  it('builds nothing when the quality gate fails', () => {
    const repo = repository(BUMPED)
    const { status, output, calls } = release(repo, [], { failGate: true })

    expect(status, output).not.toBe(0)
    expect(gatesRun(calls)).toEqual(['pnpm quality'])
    expect(builds(calls)).toEqual([])
  })

  it('says how to finish when the image build fails', () => {
    const repo = repository(BUMPED)
    const { status, output } = release(repo, ['beta'], { buildFails: true })

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/pnpm docker:build-push -- --skip-gates beta/)
  })
})

describe('release.ts refusals before the gate', () => {
  it('refuses a version whose release tag does not exist', () => {
    const repo = repository(BUMPED, [])
    const { status, output, calls } = release(repo)

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/tag v3\.11\.0 does not exist/)
    expect(gatesRun(calls)).toEqual([])
  })

  it('refuses a tag that is not in the history of HEAD', () => {
    const repo = repository(BUMPED, [])
    git(repo, 'checkout', '-q', '-b', 'elsewhere')
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'chore: elsewhere')
    git(repo, 'tag', `v${BUMPED}`)
    git(repo, 'checkout', '-q', 'main')
    const { status, output, calls } = release(repo)

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/tag v3\.11\.0 is not in the history of HEAD/)
    expect(gatesRun(calls)).toEqual([])
  })

  it('refuses when the image source changed after the tag', () => {
    const repo = repository(BUMPED)
    commit(repo, 'apps/hono/later.txt', 'feat(hono): later')
    const { status, output, calls } = release(repo)

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/changed since v3\.11\.0/)
    expect(gatesRun(calls)).toEqual([])
  })

  it('refuses a dirty working tree', () => {
    const repo = repository(BUMPED)
    fs.writeFileSync(path.join(repo, 'stray.txt'), 'stray\n')
    const { status, output, calls } = release(repo)

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/working tree is not clean/)
    expect(gatesRun(calls)).toEqual([])
  })

  it('refuses a branch other than main', () => {
    const repo = repository(BUMPED)
    git(repo, 'checkout', '-q', '-b', 'topic')
    const { status, output, calls } = release(repo)

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/on topic, not main/)
    expect(gatesRun(calls)).toEqual([])
  })

  it('refuses a main that is not level with origin', () => {
    const repo = repository(BUMPED)
    git(repo, 'commit', '-q', '--allow-empty', '-m', 'chore: local only')
    const { status, output, calls } = release(repo)

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/not level with origin\/main/)
    expect(gatesRun(calls)).toEqual([])
  })
})

describe('release.ts --dry-run', () => {
  it('prints the plan and the steps, and runs nothing but the registry lookup', () => {
    const repo = repository(BUMPED)
    const { status, output, calls } = release(repo, ['--dry-run'])

    expect(status, output).toBe(0)
    expect(output).toMatch(
      /ghcr\.io\/andrewshell\/pinsquirrel:3\.11\.0 +push: no image for 3\.11\.0 yet/
    )
    expect(output).toMatch(/pnpm quality/)
    expect(calls.filter(c => !c.startsWith('docker manifest'))).toEqual([])
  })

  it('says a run with --skip-gates would skip the gate', () => {
    const repo = repository(BUMPED)
    const { status, output } = release(repo, ['--dry-run', '--skip-gates'])

    expect(status, output).toBe(0)
    expect(output).toMatch(/Skip the quality gate \(--skip-gates\)/)
  })

  it('shows a refusal and exits non-zero', () => {
    const repo = repository(BUMPED, [])
    const { status, output } = release(repo, ['--dry-run'])

    expect(status, output).not.toBe(0)
    expect(output).toMatch(/tag v3\.11\.0 does not exist/)
  })

  it('pushes the same image the image script pushes', () => {
    const repo = repository()
    const docker = spawnSync(
      'bash',
      [path.join(repo, 'scripts', 'docker-build-push.sh'), '--dry-run'],
      { cwd: repo, encoding: 'utf8' }
    )

    expect(/Image: +(\S+)/.exec(docker.stdout)?.[1], docker.stderr).toBe(IMAGE)
    expect(docker.stdout).toMatch(/Would run the quality gate: pnpm quality/)
  })
})

describe('release.ts arguments', () => {
  it('refuses to run from anywhere but the repository root', () => {
    const repo = repository()
    const result = spawnSync(
      process.execPath,
      [path.join(repo, 'scripts', 'release.ts')],
      { cwd: path.join(repo, 'apps'), encoding: 'utf8' }
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/repository root/)
  })

  it('rejects an unknown option and a second custom tag', () => {
    const repo = repository()

    expect(release(repo, ['--force']).output).toMatch(/unknown option: --force/)
    expect(release(repo, ['beta', 'gamma']).output).toMatch(
      /only one custom tag/
    )
  })
})
