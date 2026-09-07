import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const RELEASE = fileURLToPath(new URL('../../scripts/release.mjs', import.meta.url))
const VERSION = '1.2.4'
const ASSET_NAMES = [
  `fucha-${VERSION}-macos.dmg`,
  `fucha-${VERSION}-windows-x64.exe`,
  `fucha-${VERSION}-linux-x64.AppImage`,
]
let root: string
let repo: string
let assets: string
let mergeSha: string
let env: NodeJS.ProcessEnv

function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.test', ...args],
    { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim()
}

function run(overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [join(repo, 'scripts', 'release.mjs'), 'publish', assets], {
    cwd: repo,
    env: { ...env, ...overrides },
    encoding: 'utf8',
  })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fucha-publish-'))
  repo = join(root, 'repo')
  assets = join(root, 'artifacts')
  const bin = join(root, 'bin')
  mkdirSync(repo)
  mkdirSync(assets)
  mkdirSync(bin)
  mkdirSync(join(repo, 'scripts'))
  env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(root, 'unused-global-config'),
    GIT_TERMINAL_PROMPT: '0',
    PATH: `${bin}:${process.env.PATH}`,
    VERSION,
    GH_TOKEN: 'fixture-token',
    GH_REPO: 'openchic/fucha',
    GITHUB_REPOSITORY: 'openchic/fucha',
    RUNNER_TEMP: root,
    GITHUB_STEP_SUMMARY: join(root, 'summary'),
    MOCK_RELEASE_STATE: join(root, 'release.json'),
    MOCK_GH_LOG: join(root, 'gh.log'),
    MOCK_FAIL_UPLOAD: '',
  }
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync, writeFileSync } = require('node:fs')
const { basename } = require('node:path')
const args = process.argv.slice(2)
appendFileSync(process.env.MOCK_GH_LOG, JSON.stringify(args) + '\\n')
const file = process.env.MOCK_RELEASE_STATE
let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
if (args[0] !== 'release') process.exit(2)
const action = args[1]
if (action === 'view') {
  if (!state) process.exit(1)
  console.log(args.includes('--jq') ? state.url : JSON.stringify(state))
} else if (action === 'create') {
  if (state) process.exit(1)
  state = { url: 'https://github.com/openchic/fucha/releases/tag/v1.2.4', draft: true }
} else if (action === 'upload') {
  if (process.env.MOCK_FAIL_UPLOAD === '1') process.exit(1)
  state.assets = args.slice(3).filter(arg => !arg.startsWith('--')).map(path => basename(path))
} else if (action === 'edit') {
  state.body = readFileSync(args[args.indexOf('--notes-file') + 1], 'utf8')
  state.draft = false
} else process.exit(2)
if (state) writeFileSync(file, JSON.stringify(state))
`,
    { mode: 0o755 }
  )
  git('init', '--initial-branch=main')
  git('init', '--bare', '--initial-branch=main', join(root, 'origin.git'))
  git('remote', 'add', 'origin', join(root, 'origin.git'))
  copyFileSync(RELEASE, join(repo, 'scripts', 'release.mjs'))
  writeFileSync(
    join(repo, 'package.json'),
    JSON.stringify({ name: 'fucha', version: '1.2.3' }, null, 2) + '\n'
  )
  writeFileSync(join(repo, 'changelogs.json'), '[]\n')
  git('add', 'package.json', 'changelogs.json', 'scripts/release.mjs')
  git('commit', '-m', 'feat: application')
  git('checkout', '-b', 'changelogs/v1.2.4')
  writeFileSync(
    join(repo, 'changelogs.json'),
    JSON.stringify(
      [
        {
          version: VERSION,
          version_type: 'patch',
          source_sha: git('rev-parse', 'HEAD'),
          notes: { 'zh-CN': ['改进文章预览。'], en: ['Improved previews.'] },
        },
      ],
      null,
      2
    ) + '\n'
  )
  git('add', 'changelogs.json')
  git('commit', '-m', 'docs: release notes')
  git('checkout', 'main')
  git('merge', '--no-ff', 'changelogs/v1.2.4', '-m', 'Merge approved notes')
  mergeSha = git('rev-parse', 'HEAD')
  env.RELEASE_SHA = mergeSha
  git('push', '-u', 'origin', 'main')
  ASSET_NAMES.forEach((name) => writeFileSync(join(assets, name), `installer fixture: ${name}`))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('late release commit and publication retries', () => {
  it('commits only after three installers exist and publishes English notes with downloads', () => {
    const result = run()
    expect(result.status, result.stderr).toBe(0)
    expect(git('rev-list', '--count', `${mergeSha}..origin/main`)).toBe('1')
    expect(git('rev-parse', 'v1.2.4')).toBe(git('rev-parse', 'origin/main'))
    const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'))
    expect(release.draft).toBe(false)
    expect(release.assets).toEqual(ASSET_NAMES)
    expect(release.body).toContain('Improved previews.')
    expect(release.body).not.toContain('改进文章预览')
    for (const name of ASSET_NAMES) {
      expect(release.body).toContain(`/releases/download/v1.2.4/${name}`)
    }
    expect(readFileSync(join(root, 'summary'), 'utf8')).toContain('## Downloads')
  })

  it('stops before committing or creating a tag if an installer is absent', () => {
    rmSync(join(assets, ASSET_NAMES[2]))
    const result = run()
    expect(result.status).not.toBe(0)
    expect(git('rev-parse', 'origin/main')).toBe(mergeSha)
    expect(git('tag', '--list')).toBe('')
    expect(git('diff', 'HEAD')).toBe('')
    expect(existsSync(join(root, 'gh.log'))).toBe(false)
  })

  it('reuses the final commit and tag after a Release upload failure', () => {
    const first = run({ MOCK_FAIL_UPLOAD: '1' })
    expect(first.status).not.toBe(0)
    const finalSha = git('rev-parse', 'origin/main')
    expect(finalSha).not.toBe(mergeSha)
    expect(git('rev-parse', 'v1.2.4')).toBe(finalSha)
    git('checkout', '--detach', mergeSha)
    const retry = run()
    expect(retry.status, retry.stderr).toBe(0)
    expect(git('rev-parse', 'origin/main')).toBe(finalSha)
    expect(git('rev-parse', 'v1.2.4')).toBe(finalSha)
    expect(git('rev-list', '--count', `${mergeSha}..origin/main`)).toBe('1')
    const release = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'))
    expect(release.draft).toBe(false)
    expect(release.assets).toEqual(ASSET_NAMES)
  })

  it('rejects changed installer bytes when retrying a recorded version', () => {
    expect(run({ MOCK_FAIL_UPLOAD: '1' }).status).not.toBe(0)
    const finalSha = git('rev-parse', 'origin/main')
    const previousCalls = readFileSync(join(root, 'gh.log'), 'utf8')
    writeFileSync(join(assets, ASSET_NAMES[0]), 'different installer')
    git('checkout', '--detach', mergeSha)
    expect(run().status).not.toBe(0)
    expect(git('rev-parse', 'origin/main')).toBe(finalSha)
    expect(readFileSync(join(root, 'gh.log'), 'utf8')).toBe(previousCalls)
  })

  it('does not overwrite main if application commits arrive during the build', () => {
    writeFileSync(join(repo, 'app.js'), 'new application work\n')
    git('add', 'app.js')
    git('commit', '-m', 'feat: concurrent application work')
    const newMain = git('rev-parse', 'HEAD')
    git('push', 'origin', 'main')
    git('checkout', '--detach', mergeSha)
    const result = run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('main advanced after review')
    expect(git('rev-parse', 'origin/main')).toBe(newMain)
    expect(git('tag', '--list')).toBe('')
    expect(existsSync(join(root, 'gh.log'))).toBe(false)
  })
})
