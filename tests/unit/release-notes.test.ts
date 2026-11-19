import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = fileURLToPath(new URL('../../scripts/changelog.mjs', import.meta.url))
const NOTES = { 'zh-CN': ['改进文章预览。'], en: ['Improved article previews.'] }
let root: string
let env: NodeJS.ProcessEnv

function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.test', ...args],
    { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim()
}

function run(overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['--import', join(root, 'fetch.mjs'), CLI, 'notes', '1.2.4'], {
    cwd: root,
    env: { ...env, ...overrides },
    encoding: 'utf8',
  })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fucha-notes-'))
  env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(root, 'unused-global-config'),
    GEMINI_API_KEY: 'test-key',
    MOCK_NOTES: JSON.stringify({ notes: NOTES }),
    MOCK_STATUS: '200',
  }
  git('init', '--initial-branch=main')
  writeFileSync(join(root, 'package.json'), '{"name":"fixture","version":"1.2.3"}\n')
  writeFileSync(join(root, 'changelogs.json'), '[]\n')
  writeFileSync(join(root, 'app.js'), 'never send this source code to Gemini\n')
  git('add', 'package.json', 'changelogs.json', 'app.js')
  git('commit', '-m', 'feat: original application')
  writeFileSync(
    join(root, 'fetch.mjs'),
    `import { writeFileSync } from 'node:fs'
globalThis.fetch = async (url, options) => {
  writeFileSync('request.json', JSON.stringify({ url, headers: options.headers, body: JSON.parse(options.body) }))
  return { ok: process.env.MOCK_STATUS === '200', status: Number(process.env.MOCK_STATUS),
    json: async () => ({ candidates: [{ content: { parts: [{ text: process.env.MOCK_NOTES }] } }] }) }
}
`
  )
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('incremental bilingual release notes', () => {
  it('generates corresponding notes from incremental commit titles only', () => {
    git('tag', 'v1.2.3')
    writeFileSync(join(root, 'app.js'), 'private source contents changed\n')
    git('add', 'app.js')
    git('commit', '-m', 'feat: improve article previews')
    const result = run()
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ notes: NOTES })
    const request = JSON.parse(readFileSync(join(root, 'request.json'), 'utf8'))
    expect(request.url).not.toContain('test-key')
    expect(request.headers['x-goog-api-key']).toBe('test-key')
    const prompt = request.body.contents[0].parts[0].text
    expect(prompt).toContain('feat: improve article previews')
    expect(prompt).not.toContain('feat: original application')
    expect(prompt).not.toContain('private source contents')
    expect(prompt).not.toContain('never send this source code')
    expect(git('diff', 'HEAD')).toBe('')
    expect(readFileSync(join(root, 'changelogs.json'), 'utf8')).toBe('[]\n')
  })

  it('uses all commit titles for the first release without a tag', () => {
    expect(run().status).toBe(0)
    const request = JSON.parse(readFileSync(join(root, 'request.json'), 'utf8'))
    expect(request.body.contents[0].parts[0].text).toContain('feat: original application')
  })

  it('does not call Gemini without incremental changes', () => {
    git('tag', 'v1.2.3')
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No changes since the previous release')
    expect(existsSync(join(root, 'request.json'))).toBe(false)
  })

  it('does not overwrite an existing draft or call Gemini again', () => {
    const draft = JSON.stringify([{ version: '1.2.4', reviewed: false, notes: NOTES }])
    writeFileSync(join(root, 'changelogs.json'), draft)
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('A release draft already exists')
    expect(existsSync(join(root, 'request.json'))).toBe(false)
    expect(readFileSync(join(root, 'changelogs.json'), 'utf8')).toBe(draft)
  })

  it('refuses to repeat history when the catalog release tag is missing', () => {
    writeFileSync(
      join(root, 'changelogs.json'),
      JSON.stringify([{ version: '1.2.3', published_at: '2026-11-17T00:00:00Z', notes: NOTES }])
    )
    expect(run().stderr).toContain('Previous release tag is missing')
    expect(existsSync(join(root, 'request.json'))).toBe(false)
  })

  it('fails before writing or requesting when the API key is absent', () => {
    const result = run({ GEMINI_API_KEY: '' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('GEMINI_API_KEY is required')
    expect(existsSync(join(root, 'request.json'))).toBe(false)
    expect(git('diff', 'HEAD')).toBe('')
  })

  it('fails without writing on API errors and does not print credentials', () => {
    const result = run({ MOCK_STATUS: '403' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('HTTP 403')
    expect(result.stderr).not.toContain('test-key')
    expect(result.stdout).toBe('')
    expect(git('diff', 'HEAD')).toBe('')
  })

  it.each([
    'not json',
    JSON.stringify({ notes: {} }),
    JSON.stringify({ notes: { 'zh-CN': ['中文'], en: [] } }),
    JSON.stringify({ notes: { 'zh-CN': ['中文'], en: ['One.', 'Two.'] } }),
    JSON.stringify({ notes: { 'zh-CN': [null], en: ['English.'] } }),
  ])('rejects malformed or unmatched bilingual notes: %s', (output) => {
    const result = run({ MOCK_NOTES: output })
    expect(result.status).toBe(1)
    expect(result.stdout).toBe('')
    expect(git('diff', 'HEAD')).toBe('')
  })
})
