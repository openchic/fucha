import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const CLI = fileURLToPath(new URL('../../scripts/release.mjs', import.meta.url))
const VERSION = '1.2.4'
const PACKAGE = {
  name: 'release-fixture',
  version: '1.2.3',
  repository: { type: 'git', url: 'git+https://github.com/openchic/fucha.git' },
  scripts: { start: 'node app.js' },
  dependencies: { example: '^1.0.0' },
}
const NOTES = { 'zh-CN': ['改进预览', '修复导出'], en: ['Improve preview', 'Fix export'] }
const HISTORY = [
  {
    version: '1.2.3',
    published_at: '2026-11-01T04:01:18+00:00',
    notes: { 'zh-CN': ['旧记录'], en: ['Previous release'] },
  },
  {
    version: '1.2.2',
    published_at: '2026-10-31T23:01:18.123456Z',
    notes: { 'zh-CN': ['更旧的记录'], en: ['Older release'] },
  },
]
const SUFFIXES = {
  macos: 'mac-universal.dmg',
  windows: 'win-x64-setup.exe',
  linux: 'linux-x86_64.AppImage',
}
const BAD_NOTES = [
  undefined,
  null,
  [],
  {},
  { 'zh-CN': [], en: [] },
  { 'zh-CN': [''], en: ['valid'] },
  { 'zh-CN': [' \n '], en: ['valid'] },
  { 'zh-CN': [1], en: ['valid'] },
  { 'zh-CN': 'text', en: ['valid'] },
  { 'zh-CN': null, en: ['valid'] },
  { 'zh-CN': ['valid'], en: [] },
  { 'zh-CN': ['valid'], en: [null] },
  { 'zh-CN': ['valid'], en: [''] },
  { 'zh-CN': ['valid'], en: ['one', 'two'] },
  { ...NOTES, fr: ['Extra language'] },
]

type Draft = {
  version: string
  reviewed?: boolean
  source_sha: string
  version_type?: string
  notes: unknown
}
type Asset = { name: string; size: number; sha256: string }
type Assets = Record<keyof typeof SUFFIXES, Asset>
type Published = (typeof HISTORY)[number] & { assets: Assets }
type RunOptions = { input?: string; env?: NodeJS.ProcessEnv }

let repo: string
let env: NodeJS.ProcessEnv

function git(...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.test', ...args],
    { cwd: repo, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim()
}

function writeJson(name: string, data: unknown): void {
  writeFileSync(join(repo, name), `${JSON.stringify(data, null, 2)}\n`)
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(repo, name), 'utf8'))
}

function commit(subject: string): string {
  git('add', '--', 'package.json', 'app.js')
  if (existsSync(join(repo, 'changelogs.json'))) git('add', '--', 'changelogs.json')
  git('commit', '-m', subject)
  return git('rev-parse', 'HEAD')
}

function run(args: string[], options: RunOptions = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: repo,
    encoding: 'utf8',
    input: options.input ?? JSON.stringify({ notes: NOTES }),
    env: { ...env, GITHUB_OUTPUT: '', ...options.env },
  })
}

function succeed(...args: string[]): string {
  const result = run(args)
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
  return result.stdout
}

function snapshot() {
  return {
    files: ['package.json', 'changelogs.json'].map((name) => {
      const path = join(repo, name)
      return existsSync(path)
        ? { text: readFileSync(path, 'utf8'), mtime: statSync(path).mtimeMs }
        : null
    }),
    head: git('rev-parse', 'HEAD'),
    tags: git('show-ref', '--tags', '--head'),
  }
}

function fail(args: string[], message: string, options: RunOptions = {}): void {
  const before = snapshot()
  const result = run(args, options)
  expect(result.status).toBe(1)
  expect(result.stderr).toContain(message)
  expect(result.stdout).toBe('')
  expect(snapshot()).toEqual(before)
}

function prepareDraft(): string {
  const source = git('rev-parse', 'HEAD')
  const entries = readJson<unknown[]>('changelogs.json')
  writeJson('changelogs.json', [
    { version: VERSION, version_type: 'patch', source_sha: source, notes: NOTES },
    ...entries,
  ])
  return source
}

function editDraft(edit: (entry: Draft) => void): void {
  const entries = readJson<Draft[]>('changelogs.json')
  edit(entries[0])
  writeJson('changelogs.json', entries)
}

function editCatalog(edit: (entries: Published[]) => void): void {
  const entries = readJson<Published[]>('changelogs.json')
  edit(entries)
  writeJson('changelogs.json', entries)
}

function mergeDraft(): string {
  prepareDraft()
  return commit('chore: review release notes')
}

function createArtifacts(version = VERSION): { directory: string; assets: Assets } {
  const directory = join(repo, 'installers')
  mkdirSync(directory)
  function createAsset(platform: keyof Assets): Asset {
    const name = `fucha-${version}-${SUFFIXES[platform]}`
    const bytes = Buffer.from(`Installer fixture for ${platform}\n`)
    writeFileSync(join(directory, name), bytes)
    return { name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  return {
    directory,
    assets: {
      macos: createAsset('macos'),
      windows: createAsset('windows'),
      linux: createAsset('linux'),
    },
  }
}

function finalizeDraft() {
  const mergeSha = mergeDraft()
  const { directory, assets } = createArtifacts()
  succeed('finalize', VERSION, directory)
  return { mergeSha, directory, assets }
}

function publish(): string {
  const head = commit('chore: publish release')
  git('tag', `v${VERSION}`)
  return head
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'fucha-release-'))
  env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith('GIT_') && key !== 'GITHUB_REPOSITORY'
      )
    ),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: join(repo, 'unused-global-config'),
    GIT_TERMINAL_PROMPT: '0',
  }
  git('init', '--initial-branch=main')
  writeJson('package.json', PACKAGE)
  writeJson('changelogs.json', HISTORY)
  writeFileSync(join(repo, 'app.js'), 'export const value = 1\n')
  commit('feat: initial application')
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('release CLI: arguments', () => {
  it.each([{ args: [] }, { args: ['unknown'] }, { args: ['prepare', 'patch'] }])(
    'rejects invalid command $args',
    ({ args }) => {
      fail(args, 'Unknown command')
    }
  )

  it.each(['body', 'confirm-merge', 'stage-version'])('requires a version for %s', (command) => {
    fail([command], 'Usage:')
  })

  it.each(['body', 'confirm-merge', 'stage-version', 'finalize', 'verify-final'])(
    'validates the version for %s',
    (command) => {
      const extra =
        command === 'finalize'
          ? ['/missing']
          : command === 'verify-final'
            ? ['/missing', 'a'.repeat(40)]
            : []
      fail([command, 'v1.2.4', ...extra], 'Invalid stable semver')
    }
  )
})

describe('release CLI: read-only merge validation and staging', () => {
  it.each([false, true])(
    'confirms reviewed=%s without changing it or requiring origin/main',
    (reviewed) => {
      git('checkout', '-b', 'release')
      const sourceSha = prepareDraft()
      editDraft((entry) => {
        entry.reviewed = reviewed
      })
      commit('chore: release notes PR')
      git('checkout', 'main')
      git('merge', '--no-ff', 'release', '-m', 'Merge release PR')
      const before = snapshot()
      const output = join(repo, 'github-output')
      writeFileSync(output, 'previous=value\n')
      const result = run(['confirm-merge', VERSION], { env: { GITHUB_OUTPUT: output } })
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(readFileSync(output, 'utf8')).toBe(`previous=value\nversion=${VERSION}\n`)
      expect(readJson<Draft[]>('changelogs.json')[0]).toMatchObject({
        reviewed,
        source_sha: sourceSha,
      })
      expect(snapshot()).toEqual(before)
    }
  )

  it('confirms a release-bits draft without review or version_type', () => {
    git('checkout', '-b', 'release')
    const sourceSha = prepareDraft()
    const entries = readJson<Record<string, unknown>[]>('changelogs.json')
    delete entries[0].reviewed
    delete entries[0].version_type
    writeJson('changelogs.json', entries)
    commit('chore: release-bits release notes')
    git('checkout', 'main')
    git('merge', '--no-ff', 'release', '-m', 'Merge release-bits notes')
    succeed('confirm-merge', VERSION)
    expect(readJson<Record<string, unknown>[]>('changelogs.json')[0]).toMatchObject({
      source_sha: sourceSha,
      version: VERSION,
    })
  })

  it('stages only the local version while preserving formatting and nested versions', () => {
    const text = '{\r\n\t"nested": {"version":"9.8.7"}, "version" : "1.2.3", "name": "fixture"\r\n}'
    writeFileSync(join(repo, 'package.json'), text)
    commit('chore: formatting fixture')
    mergeDraft()
    const before = snapshot()
    succeed('stage-version', VERSION)
    expect(readFileSync(join(repo, 'package.json'), 'utf8')).toBe(
      text.replace('"1.2.3"', '"1.2.4"')
    )
    expect(snapshot().files[1]).toEqual(before.files[1])
    expect(snapshot().head).toEqual(before.head)
    expect(snapshot().tags).toEqual(before.tags)
    expect(git('diff', '--name-only')).toBe('package.json')
    fail(['finalize', VERSION, join(repo, 'missing')], 'Tracked files must match HEAD')
  })

  it('allows Git-normalized CRLF checkouts when staging Windows builds', () => {
    writeFileSync(join(repo, '.gitattributes'), '*.json text\n')
    git('add', '--', '.gitattributes')
    commit('chore: normalize checkout line endings')
    mergeDraft()
    const path = join(repo, 'package.json')
    const text = readFileSync(path, 'utf8').replaceAll('\n', '\r\n')
    writeFileSync(path, text)
    expect(git('diff', 'HEAD')).toBe('')
    succeed('confirm-merge', VERSION)
    succeed('stage-version', VERSION)
    expect(readFileSync(path, 'utf8')).toBe(text.replace('"1.2.3"', '"1.2.4"'))
  })

  it.each(['confirm-merge', 'stage-version', 'finalize'])(
    'rejects existing tags in %s and emits no output metadata',
    (command) => {
      mergeDraft()
      git('tag', `v${VERSION}`)
      const output = join(repo, 'github-output')
      const args = [command, VERSION, ...(command === 'finalize' ? [join(repo, 'missing')] : [])]
      fail(args, `Tag v${VERSION} already exists`, { env: { GITHUB_OUTPUT: output } })
      expect(existsSync(output)).toBe(false)
    }
  )

  it.each(['name', 'scripts', 'dependencies', 'version'])(
    'rejects package.%s changes during review',
    (field) => {
      prepareDraft()
      writeJson('package.json', { ...PACKAGE, [field]: field === 'version' ? VERSION : 'tampered' })
      commit('chore: tampered package')
      fail(
        ['confirm-merge', VERSION],
        field === 'version' ? 'original package version' : 'identical to source_sha'
      )
    }
  )

  it.each(['app.js', 'package.json'])('rejects temporary %s changes even when reverted', (name) => {
    prepareDraft()
    const original = readFileSync(join(repo, name), 'utf8')
    writeFileSync(join(repo, name), `${original}\n`)
    commit('chore: temporary change')
    writeFileSync(join(repo, name), original)
    commit('revert: temporary change')
    fail(['confirm-merge', VERSION], `Release commits changed forbidden paths: ${name}`)
  })

  it('rejects application changes merged into main while the release PR is open', () => {
    git('checkout', '-b', 'release')
    prepareDraft()
    commit('chore: release draft')
    git('checkout', 'main')
    writeFileSync(join(repo, 'app.js'), 'export const value = 2\n')
    commit('feat: concurrent change')
    git('merge', '--no-ff', 'release', '-m', 'Merge release PR')
    fail(['confirm-merge', VERSION], 'Release commits changed forbidden paths: app.js')
  })

  it('rejects a dirty index even if worktree files match HEAD', () => {
    mergeDraft()
    const original = readFileSync(join(repo, 'app.js'), 'utf8')
    writeFileSync(join(repo, 'app.js'), 'staged changes\n')
    git('add', '--', 'app.js')
    writeFileSync(join(repo, 'app.js'), original)
    fail(['confirm-merge', VERSION], 'Tracked files must match HEAD')
  })

  it.each(['edit', 'remove', 'reorder', 'append'])('rejects %s of history', (action) => {
    prepareDraft()
    const entries = readJson<Record<string, unknown>[]>('changelogs.json')
    if (action === 'edit') entries[1].notes = NOTES
    if (action === 'remove') entries.pop()
    if (action === 'reorder') [entries[1], entries[2]] = [entries[2], entries[1]]
    if (action === 'append') entries.push({ ...HISTORY[1], version: '1.2.1' })
    writeJson('changelogs.json', entries)
    commit('chore: altered history')
    fail(['confirm-merge', VERSION], 'Historical changelog records must remain unchanged')
  })

  it.each(['', 'not-a-commit', 'a'.repeat(39), 'g'.repeat(40), `${'a'.repeat(40)}\n`])(
    'rejects malformed source_sha %j',
    (source) => {
      prepareDraft()
      editDraft((entry) => {
        entry.source_sha = source
      })
      commit('chore: bad source')
      fail(['confirm-merge', VERSION], 'source_sha must be a 40-hex commit')
    }
  )

  it('rejects a missing source commit', () => {
    prepareDraft()
    editDraft((entry) => {
      entry.source_sha = 'a'.repeat(40)
    })
    commit('chore: missing source')
    fail(['confirm-merge', VERSION], 'source_sha must identify an ancestor')
  })

  it('rejects a source outside HEAD ancestry', () => {
    git('checkout', '-b', 'unrelated')
    writeFileSync(join(repo, 'app.js'), 'export const value = 2\n')
    const unrelated = commit('feat: unrelated branch')
    git('checkout', 'main')
    prepareDraft()
    editDraft((entry) => {
      entry.source_sha = unrelated
    })
    commit('chore: unrelated source')
    fail(['confirm-merge', VERSION], 'source_sha must identify an ancestor')
  })

  it.each(['1.2.5', '1.1.0', '2.1.0', '1.2.3'])('rejects invalid next version %s', (version) => {
    prepareDraft()
    editDraft((entry) => {
      entry.version = version
    })
    commit('chore: invalid bump')
    fail(
      ['confirm-merge', version],
      version === '1.1.0' || version === '1.2.3' ? 'newer than every' : 'original package version'
    )
  })

  it('requires the selected bump type, not just any legal bump', () => {
    prepareDraft()
    editDraft((entry) => {
      entry.version_type = 'minor'
    })
    commit('chore: wrong release type')
    fail(['confirm-merge', VERSION], 'selected bump')
  })

  it('requires committed release metadata', () => {
    prepareDraft()
    fail(['confirm-merge', VERSION], 'Tracked files must match HEAD')
  })

  it.each(BAD_NOTES.map((notes) => ({ notes })))(
    'rejects invalid draft notes $notes for preview and merge',
    ({ notes }) => {
      prepareDraft()
      editDraft((entry) => {
        entry.notes = notes
      })
      commit('chore: invalid notes')
      fail(['confirm-merge', VERSION], notes === undefined ? 'release draft' : 'notes')
    }
  )
})

describe('release CLI: finalize all platform installers', () => {
  it('publishes the package and bilingual catalog only after all artifacts exist', () => {
    const { mergeSha, assets } = finalizeDraft()
    expect(readJson('package.json')).toEqual({ ...PACKAGE, version: VERSION })
    const entries = readJson<Published[]>('changelogs.json')
    expect(Object.keys(entries[0]).sort()).toEqual(['assets', 'notes', 'published_at', 'version'])
    expect(entries[0]).toMatchObject({ version: VERSION, notes: NOTES, assets })
    expect(new Date(entries[0].published_at).toISOString()).toBe(entries[0].published_at)
    expect(entries.slice(1)).toEqual(HISTORY)
    expect(git('rev-parse', 'HEAD')).toBe(mergeSha)
    expect(git('tag', '--list')).toBe('')
    expect(git('diff', '--name-only').split('\n').sort()).toEqual([
      'changelogs.json',
      'package.json',
    ])
  })

  it('hashes multiple stream chunks and records the exact byte size', () => {
    mergeDraft()
    const { directory, assets } = createArtifacts()
    const bytes = Buffer.alloc(2 * 1024 * 1024 + 37, 123)
    writeFileSync(join(directory, assets.macos.name), bytes)
    succeed('finalize', VERSION, directory)
    expect(readJson<Published[]>('changelogs.json')[0].assets.macos).toEqual({
      name: assets.macos.name,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    })
  })

  it.each(Object.keys(SUFFIXES) as (keyof Assets)[])(
    'rejects missing %s installers without writes',
    (platform) => {
      mergeDraft()
      const { directory, assets } = createArtifacts()
      rmSync(join(directory, assets[platform].name))
      fail(['finalize', VERSION, directory], 'ENOENT')
    }
  )

  it('rejects an empty artifact directory without writes', () => {
    mergeDraft()
    const directory = join(repo, 'installers')
    mkdirSync(directory)
    fail(['finalize', VERSION, directory], 'ENOENT')
  })

  it('requires a clean review merge instead of silently restaging a built package', () => {
    mergeDraft()
    const { directory } = createArtifacts()
    succeed('stage-version', VERSION)
    fail(['finalize', VERSION, directory], 'Tracked files must match HEAD')
  })

  it.each(['empty', 'symlink', 'directory', 'fifo'])(
    'rejects a %s installer without writes',
    (kind) => {
      mergeDraft()
      const { directory, assets } = createArtifacts()
      const path = join(directory, assets.linux.name)
      rmSync(path)
      if (kind === 'empty') writeFileSync(path, '')
      if (kind === 'symlink') symlinkSync(join(directory, assets.macos.name), path)
      if (kind === 'directory') mkdirSync(path)
      if (kind === 'fifo') execFileSync('mkfifo', [path])
      fail(
        ['finalize', VERSION, directory],
        kind === 'empty' ? 'non-empty regular file' : 'regular file, not a symlink'
      )
    }
  )

  it('rejects symlinked artifact directories', () => {
    mergeDraft()
    const { directory } = createArtifacts()
    const link = join(repo, 'installer-link')
    symlinkSync(directory, link)
    fail(['finalize', VERSION, link], 'real directory, not a symlink')
  })

  it('does not mistake arm64-only DMGs for the universal installer', () => {
    mergeDraft()
    const { directory, assets } = createArtifacts()
    rmSync(join(directory, assets.macos.name))
    writeFileSync(join(directory, `fucha-${VERSION}-mac-arm64.dmg`), 'arm64 only')
    fail(['finalize', VERSION, directory], 'ENOENT')
  })
})

describe('release CLI: immutable retry verification', () => {
  it.each([false, true])(
    'verifies an existing release repeatedly without writes or tags (annotated: %s)',
    (annotated) => {
      const { mergeSha, directory } = finalizeDraft()
      const head = commit('chore: publish release')
      if (annotated) git('tag', '-a', `v${VERSION}`, '-m', 'Published release')
      else git('tag', `v${VERSION}`)
      const before = snapshot()
      for (let i = 0; i < 2; i += 1) {
        expect(succeed('verify-final', VERSION, directory, mergeSha)).toContain(`at ${head}`)
        expect(snapshot()).toEqual(before)
      }
      fail(['finalize', VERSION, directory], 'release draft')
      expect(snapshot()).toEqual(before)
    }
  )

  it('verifies committed content despite Git-normalized checkout line endings', () => {
    writeFileSync(join(repo, '.gitattributes'), '*.json text\n')
    git('add', '--', '.gitattributes')
    commit('chore: normalize checkout line endings')
    const { mergeSha, directory } = finalizeDraft()
    publish()
    for (const name of ['package.json', 'changelogs.json']) {
      const path = join(repo, name)
      writeFileSync(path, readFileSync(path, 'utf8').replaceAll('\n', '\r\n'))
    }
    const before = snapshot()
    succeed('verify-final', VERSION, directory, mergeSha)
    expect(snapshot()).toEqual(before)
  })

  it('requires mergeSha as the unique parent', () => {
    const { directory } = finalizeDraft()
    publish()
    const source = git('rev-parse', 'HEAD~2')
    fail(['verify-final', VERSION, directory, source], 'only parent')
  })

  it('rejects a final commit with two parents', () => {
    const { mergeSha, directory } = finalizeDraft()
    git('checkout', '-b', 'publication')
    commit('chore: publication branch')
    git('checkout', 'main')
    git('merge', '--no-ff', 'publication', '-m', 'Merge publication')
    git('tag', `v${VERSION}`)
    fail(['verify-final', VERSION, directory, mergeSha], 'only parent')
  })

  it.each(['missing', 'elsewhere'])('rejects a tag that is %s', (kind) => {
    const { mergeSha, directory } = finalizeDraft()
    commit('chore: published files')
    if (kind === 'elsewhere') git('tag', `v${VERSION}`, mergeSha)
    fail(['verify-final', VERSION, directory, mergeSha], 'must already point to HEAD')
  })

  it('rejects local modifications on retry', () => {
    const { mergeSha, directory } = finalizeDraft()
    publish()
    writeFileSync(join(repo, 'app.js'), 'local edits')
    fail(['verify-final', VERSION, directory, mergeSha], 'Tracked files must match HEAD')
  })

  it('rejects final file mode changes', () => {
    const { mergeSha, directory } = finalizeDraft()
    git('update-index', '--chmod=+x', '--', 'changelogs.json')
    git('add', '--', 'package.json')
    git('commit', '-m', 'chore: altered catalog file mode')
    git('tag', `v${VERSION}`)
    // Match the worktree mode to the malicious commit before checking its provenance.
    execFileSync('chmod', ['+x', join(repo, 'changelogs.json')])
    fail(['verify-final', VERSION, directory, mergeSha], 'must not change file modes')
  })

  it('rejects a final package version that differs from the catalog', () => {
    const { mergeSha, directory } = finalizeDraft()
    writeJson('package.json', { ...PACKAGE, version: '1.2.5' })
    publish()
    fail(['verify-final', VERSION, directory, mergeSha], 'version and argument must match')
  })

  it('rejects additional changed files in the final commit', () => {
    const { mergeSha, directory } = finalizeDraft()
    writeFileSync(join(repo, 'app.js'), 'export const value = 2\n')
    publish()
    fail(
      ['verify-final', VERSION, directory, mergeSha],
      'change only package.json and changelogs.json'
    )
  })

  it.each(['name', 'formatting'])(
    'rejects extra package %s changes in the final commit',
    (kind) => {
      const { mergeSha, directory } = finalizeDraft()
      if (kind === 'name')
        writeJson('package.json', { ...PACKAGE, name: 'tampered', version: VERSION })
      else
        writeFileSync(join(repo, 'package.json'), JSON.stringify({ ...PACKAGE, version: VERSION }))
      publish()
      fail(['verify-final', VERSION, directory, mergeSha], 'change only the version value')
    }
  )

  it.each(['notes', 'history', 'version', 'date', 'draft-field'])(
    'rejects altered final %s',
    (kind) => {
      const { mergeSha, directory } = finalizeDraft()
      editCatalog((entries) => {
        if (kind === 'notes') entries[0].notes.en = ['Different notes', 'Fix export']
        if (kind === 'history') entries.pop()
        if (kind === 'version') entries[0].version = '1.2.5'
        if (kind === 'date') entries[0].published_at = '2026-02-30T00:00:00Z'
        if (kind === 'draft-field') Object.assign(entries[0], { reviewed: true })
      })
      publish()
      const messages = {
        notes: 'notes must equal the merged draft',
        history: 'Historical changelog records',
        version: 'version and argument must match',
        date: 'published_at must be a valid ISO',
        'draft-field': 'published records, not drafts',
      }
      fail(['verify-final', VERSION, directory, mergeSha], messages[kind])
    }
  )

  it.each(['source', 'history', 'version_type'])(
    'revalidates the merged draft %s on retry',
    (kind) => {
      prepareDraft()
      const original = readJson<unknown[]>('changelogs.json')
      const entries = readJson<Draft[]>('changelogs.json')
      if (kind === 'source') entries[0].source_sha = 'a'.repeat(40)
      if (kind === 'history') entries.pop()
      if (kind === 'version_type') entries[0].version_type = 'minor'
      writeJson('changelogs.json', entries)
      const mergeSha = commit('chore: invalid merged draft')
      const { directory, assets } = createArtifacts()
      writeJson('package.json', { ...PACKAGE, version: VERSION })
      writeJson('changelogs.json', [
        { version: VERSION, published_at: new Date().toISOString(), notes: NOTES, assets },
        ...original.slice(1),
      ])
      publish()
      const message =
        kind === 'source'
          ? 'source_sha must identify an ancestor'
          : kind === 'history'
            ? 'Historical changelog records'
            : 'selected bump'
      fail(['verify-final', VERSION, directory, mergeSha], message)
    }
  )

  it.each(['hash', 'size', 'name'])('rejects mismatched final asset %s', (kind) => {
    const { mergeSha, directory } = finalizeDraft()
    editCatalog((entries) => {
      if (kind === 'hash') entries[0].assets.windows.sha256 = '0'.repeat(64)
      if (kind === 'size') entries[0].assets.windows.size += 1
      if (kind === 'name') entries[0].assets.windows.name = 'other.exe'
    })
    publish()
    fail(
      ['verify-final', VERSION, directory, mergeSha],
      kind === 'name' ? 'Invalid windows asset metadata' : 'SHA-256 hashes must match'
    )
  })

  it('rejects modified local bytes even when the size is unchanged', () => {
    const { mergeSha, directory, assets } = finalizeDraft()
    publish()
    writeFileSync(join(directory, assets.macos.name), Buffer.alloc(assets.macos.size))
    fail(['verify-final', VERSION, directory, mergeSha], 'SHA-256 hashes must match')
  })

  it('rejects missing local installers on retry', () => {
    const { mergeSha, directory, assets } = finalizeDraft()
    publish()
    rmSync(join(directory, assets.linux.name))
    fail(['verify-final', VERSION, directory, mergeSha], 'ENOENT')
  })
})

describe('release CLI: English GitHub Release body', () => {
  it('outputs only English notes and three correctly versioned download links', () => {
    finalizeDraft()
    const before = snapshot()
    expect(succeed('body', VERSION)).toBe(
      '- Improve preview\n- Fix export\n\n## Downloads\n\n' +
        `- [macOS (Universal)](https://github.com/openchic/fucha/releases/download/v${VERSION}/fucha-${VERSION}-mac-universal.dmg)\n` +
        `- [Windows (x64)](https://github.com/openchic/fucha/releases/download/v${VERSION}/fucha-${VERSION}-win-x64-setup.exe)\n` +
        `- [Linux (x64)](https://github.com/openchic/fucha/releases/download/v${VERSION}/fucha-${VERSION}-linux-x86_64.AppImage)\n`
    )
    expect(snapshot()).toEqual(before)
  })

  it('uses a valid GITHUB_REPOSITORY in preference to package.repository.url', () => {
    finalizeDraft()
    const result = run(['body', VERSION], {
      env: { GITHUB_REPOSITORY: 'Another-Owner/project.name' },
    })
    expect(result.status).toBe(0)
    expect(
      result.stdout.match(/https:\/\/github.com\/Another-Owner\/project.name\/releases\/download/g)
    ).toHaveLength(3)
    expect(result.stdout).not.toContain('openchic/fucha')
    expect(result.stdout).not.toMatch(/改进|修复|旧记录/)
  })

  it.each([
    '',
    'owner',
    'owner/repo/extra',
    '../repo',
    'owner/..',
    'owner/repo?x=1',
    'owner/repo\n',
    'https://github.com/o/r',
    'owner/repo#x',
  ])('rejects unsafe repository %j', (repository) => {
    finalizeDraft()
    fail(['body', VERSION], 'strict owner/repo', { env: { GITHUB_REPOSITORY: repository } })
  })

  it.each([
    'https://github.com.evil.test/o/r.git',
    'https://user@github.com/o/r.git',
    'https://github.com/o/r.git?query=1',
    'http://github.com/o/r.git',
    'https://github.com/o/r.git#fragment',
    'git+https://github.com/o/r.git\n',
    'https://github.com/o/../r.git',
  ])('rejects unsafe package repository URL %j', (url) => {
    finalizeDraft()
    writeJson('package.json', { ...PACKAGE, version: VERSION, repository: { url } })
    fail(['body', VERSION], 'package.repository.url must be a GitHub HTTPS URL')
  })

  it('rejects a draft, a missing catalog, or a package version mismatch', () => {
    prepareDraft()
    fail(['body', VERSION], 'version and argument must match')
    writeJson('changelogs.json', [])
    fail(['body', VERSION], 'version and argument must match')
  })
})
