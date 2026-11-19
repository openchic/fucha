import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync,
  constants,
  lstatSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { open } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { isDeepStrictEqual } from 'node:util'

const ROOT = process.cwd()
const RELEASE_TYPES = ['major', 'minor', 'patch']
const DRAFT_FIELDS = ['reviewed', 'source_sha', 'version_type']
const PLATFORMS = {
  macos: { suffix: 'mac-universal.dmg', label: 'macOS (Universal)' },
  windows: { suffix: 'win-x64-setup.exe', label: 'Windows (x64)' },
  linux: { suffix: 'linux-x64.AppImage', label: 'Linux (x64)' },
}
function gitResult(...args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

function git(...args) {
  const result = gitResult(...args)
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim() || result.signal}`)
  }
  return result.stdout
}

function parseVersion(version) {
  const match =
    typeof version === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version)
  if (!match || match[0] !== version) {
    throw new Error(`Invalid stable semver: ${JSON.stringify(version)}`)
  }
  return match.slice(1).map((part) => BigInt(part))
}

function nextVersion(version, type) {
  const index = RELEASE_TYPES.indexOf(type)
  if (index === -1) throw new Error('Release type must be major, minor or patch')
  return parseVersion(version)
    .map((part, partIndex) => (partIndex < index ? part : partIndex === index ? part + 1n : 0n))
    .join('.')
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  return isRecord(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort())
}

function parseJson(text, label) {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${label} must contain valid JSON`)
  }
}

function replacePackageVersion(text, version) {
  let depth = 0
  const spans = []
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]]/g)) {
    const token = match[0]
    if (token === '{' || token === '[') depth += 1
    else if (token === '}' || token === ']') depth -= 1
    else if (depth === 1 && JSON.parse(token) === 'version') {
      const end = match.index + token.length
      const value = /^(\s*:\s*)("(?:\\.|[^"\\])*")/.exec(text.slice(end))
      if (value) spans.push([end + value[1].length, end + value[0].length])
    }
  }
  if (spans.length !== 1) throw new Error('package.json must have exactly one top-level version')
  const [start, end] = spans[0]
  return text.slice(0, start) + JSON.stringify(version) + text.slice(end)
}

function parsePackage(text) {
  const data = parseJson(text, 'package.json')
  if (!isRecord(data)) throw new Error('package.json must be an object')
  parseVersion(data.version)
  replacePackageVersion(text, data.version)
  return data
}

function parseChangelogs(text) {
  const data = parseJson(text, 'changelogs.json')
  if (!Array.isArray(data)) throw new Error('changelogs.json must be an array')
  return data
}

function readChangelogs() {
  let text
  try {
    text = readFileSync(resolve(ROOT, 'changelogs.json'), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  return parseChangelogs(text)
}

function changelogsAt(commit) {
  if (!git('ls-tree', '--name-only', commit, '--', 'changelogs.json').trim()) return []
  return parseChangelogs(git('show', `${commit}:changelogs.json`))
}

function readState(commit) {
  const packageText = commit
    ? git('show', `${commit}:package.json`)
    : readFileSync(resolve(ROOT, 'package.json'), 'utf8')
  return {
    packageText,
    packageData: parsePackage(packageText),
    changelogs: commit ? changelogsAt(commit) : readChangelogs(),
  }
}

function validateNotes(notes) {
  for (const language of ['zh-CN', 'en']) {
    const entries = isRecord(notes) && notes[language]
    if (
      !Array.isArray(entries) ||
      entries.length === 0 ||
      entries.some((note) => typeof note !== 'string' || !note.trim())
    ) {
      throw new Error(`notes.${language} must be a non-empty list of non-empty strings`)
    }
  }
  if (notes['zh-CN'].length !== notes.en.length) {
    throw new Error('notes.zh-CN and notes.en must have equal lengths')
  }
  if (!hasExactKeys(notes, ['zh-CN', 'en'])) {
    throw new Error('notes must contain only zh-CN and en')
  }
}

function validatePublishedAt(timestamp) {
  const match =
    typeof timestamp === 'string' &&
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      timestamp
    )
  // Date.parse alone accepts impossible dates such as February 30 and hour 24.
  const localDate = match && new Date(`${match[1]}Z`)
  if (
    !match ||
    match[0] !== timestamp ||
    !Number.isFinite(Date.parse(timestamp)) ||
    !Number.isFinite(localDate.getTime()) ||
    localDate.toISOString().slice(0, 19) !== match[1]
  ) {
    throw new Error('published_at must be a valid ISO timestamp with a timezone')
  }
}

function assetName(version, platform) {
  return `fucha-${version}-${PLATFORMS[platform].suffix}`
}

function validateAssets(assets, version) {
  if (!hasExactKeys(assets, Object.keys(PLATFORMS))) {
    throw new Error('assets must contain macos, windows and linux')
  }
  for (const platform of Object.keys(PLATFORMS)) {
    const asset = assets[platform]
    if (
      !hasExactKeys(asset, ['name', 'size', 'sha256']) ||
      asset.name !== assetName(version, platform) ||
      !Number.isSafeInteger(asset.size) ||
      asset.size <= 0 ||
      typeof asset.sha256 !== 'string' ||
      asset.sha256.length !== 64 ||
      !/^[a-f\d]{64}$/.test(asset.sha256)
    ) {
      throw new Error(`Invalid ${platform} asset metadata`)
    }
  }
}

function validateCatalog(changelogs) {
  const versions = new Set()
  for (const entry of changelogs) {
    if (!isRecord(entry) || DRAFT_FIELDS.some((field) => Object.hasOwn(entry, field))) {
      throw new Error('Historical catalog must contain published records, not drafts')
    }
    parseVersion(entry.version)
    validatePublishedAt(entry.published_at)
    validateNotes(entry.notes)
    if (versions.has(entry.version)) throw new Error(`Duplicate catalog version: ${entry.version}`)
    versions.add(entry.version)
    if (Object.hasOwn(entry, 'assets')) validateAssets(entry.assets, entry.version)
  }
}

function assertNewVersion(version, history) {
  const parts = parseVersion(version)
  for (const entry of history) {
    const previous = parseVersion(entry.version)
    const index = parts.findIndex((part, i) => part !== previous[i])
    if (index === -1 || parts[index] < previous[index]) {
      throw new Error('Candidate version must be newer than every published catalog version')
    }
  }
}

function validateCommit(sha, label) {
  if (typeof sha !== 'string' || sha.length !== 40 || !/^[a-f\d]{40}$/.test(sha)) {
    throw new Error(`${label} must be a 40-hex commit`)
  }
}

function tagCommit(version) {
  const ref = `refs/tags/v${version}`
  const result = gitResult('show-ref', '--verify', '--quiet', ref)
  if (result.status === 1) return null
  if (result.status !== 0) throw new Error(`Cannot inspect ${ref}: ${result.stderr.trim()}`)
  return git('rev-parse', '--verify', `${ref}^{commit}`).trim()
}

function assertUnpublished(version) {
  if (tagCommit(version)) throw new Error(`Tag v${version} already exists; refusing to republish`)
}

function assertClean() {
  if (
    git('diff', '--name-only', '-z', 'HEAD', '--') ||
    git('diff', '--cached', '--name-only', '-z', 'HEAD', '--')
  ) {
    throw new Error('Tracked files must match HEAD; commit or remove local edits first')
  }
}

function draftEntry(version, changelogs) {
  parseVersion(version)
  const entry = changelogs[0]
  if (entry?.version !== version)
    throw new Error('The first changelog version must match the argument')
  const draftKeys = ['version', 'source_sha', 'notes']
  if (
    !isRecord(entry) ||
    draftKeys.some((key) => !Object.hasOwn(entry, key)) ||
    Object.keys(entry).some(
      (key) => !draftKeys.includes(key) && !['reviewed', 'version_type'].includes(key)
    ) ||
    (Object.hasOwn(entry, 'reviewed') && typeof entry.reviewed !== 'boolean')
  ) {
    throw new Error('The first changelog must be a release draft')
  }
  validateCommit(entry.source_sha, 'source_sha')
  if (Object.hasOwn(entry, 'version_type') && !RELEASE_TYPES.includes(entry.version_type)) {
    throw new Error('Release type must be major, minor or patch')
  }
  validateNotes(entry.notes)
  validateCatalog(changelogs.slice(1))
  assertNewVersion(version, changelogs.slice(1))
  return entry
}

function validateDraft(version, state, head) {
  const { packageData, changelogs } = state
  const entry = draftEntry(version, changelogs)
  if (Object.hasOwn(entry, 'version_type')) {
    if (nextVersion(packageData.version, entry.version_type) !== version) {
      throw new Error('Draft version must match the selected bump of the original package version')
    }
  } else {
    const parts = parseVersion(version)
    const base = parseVersion(packageData.version)
    const index = parts.findIndex((part, i) => part !== base[i])
    if (index === -1 || parts[index] < base[index]) {
      throw new Error('Draft version must be newer than the original package version')
    }
  }
  if (gitResult('merge-base', '--is-ancestor', entry.source_sha, head).status !== 0) {
    throw new Error('source_sha must identify an ancestor of HEAD')
  }
  const source = readState(entry.source_sha)
  if (!isDeepStrictEqual(packageData, source.packageData)) {
    throw new Error('package.json must remain identical to source_sha during review')
  }
  const paths = git(
    'log',
    '--format=',
    '--name-only',
    '-z',
    '--no-renames',
    '-m',
    `${entry.source_sha}..${head}`,
    '--'
  )
    .split('\0')
    .filter(Boolean)
  const forbidden = [...new Set(paths.filter((path) => path !== 'changelogs.json'))]
  if (forbidden.length) {
    throw new Error(`Release commits changed forbidden paths: ${forbidden.join(', ')}`)
  }
  if (!isDeepStrictEqual(changelogs.slice(1), source.changelogs)) {
    throw new Error('Historical changelog records must remain unchanged')
  }
  return entry
}

function validateMerge(version) {
  parseVersion(version)
  assertClean()
  git('ls-files', '--error-unmatch', '--', 'package.json', 'changelogs.json')
  const head = git('rev-parse', '--verify', 'HEAD^{commit}').trim()
  const state = readState()
  const entry = validateDraft(version, state, head)
  assertUnpublished(version)
  return { ...state, entry, head }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args[0]} failed${result.stderr ? `: ${result.stderr.trim()}` : ''}`
    )
  }
  return result.stdout ?? ''
}

function gh(args, allowFailure = false) {
  const result = spawnSync('gh', args, { cwd: ROOT, encoding: 'utf8', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) {
    if (allowFailure) return null
    throw new Error(result.stderr.trim() || `gh ${args.slice(0, 2).join(' ')} failed`)
  }
  return result.stdout
}

function stageVersion(version) {
  const { packageText } = validateMerge(version)
  writeFileSync(resolve(ROOT, 'package.json'), replacePackageVersion(packageText, version))
  console.log(`Staged ${version} locally for packaging`)
}

async function readArtifacts(version, artifactDir) {
  const directory = resolve(ROOT, artifactDir)
  if (!lstatSync(directory).isDirectory()) {
    throw new Error('Artifact directory must be a real directory, not a symlink')
  }
  const assets = {}
  for (const platform of Object.keys(PLATFORMS)) {
    const name = `fucha-${version}-${PLATFORMS[platform].suffix}`
    const path = resolve(directory, name)
    if (!lstatSync(path).isFile()) throw new Error(`${name} must be a regular file, not a symlink`)
    // O_NOFOLLOW/O_NONBLOCK also protect the open if the file changes after lstat.
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const before = await file.stat()
      if (!before.isFile() || !Number.isSafeInteger(before.size) || before.size <= 0) {
        throw new Error(`${name} must be a non-empty regular file`)
      }
      const hash = createHash('sha256')
      let size = 0
      for await (const chunk of file.createReadStream({ autoClose: false })) {
        hash.update(chunk)
        size += chunk.length
      }
      const after = await file.stat()
      if (
        size !== before.size ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs
      ) {
        throw new Error(`${name} changed while hashing`)
      }
      assets[platform] = { name, size, sha256: hash.digest('hex') }
    } finally {
      await file.close()
    }
  }
  return assets
}

async function finalize(version, artifactDir) {
  const { packageText, changelogs, entry, head } = validateMerge(version)
  const assets = await readArtifacts(version, artifactDir)
  const published = { version, published_at: new Date().toISOString(), notes: entry.notes, assets }
  const catalog = JSON.stringify([published, ...changelogs.slice(1)], null, 2) + '\n'
  const updatedPackage = replacePackageVersion(packageText, version)
  assertClean()
  if (git('rev-parse', 'HEAD').trim() !== head) throw new Error('HEAD changed during finalization')
  assertUnpublished(version)
  writeFileSync(resolve(ROOT, 'package.json'), updatedPackage)
  writeFileSync(resolve(ROOT, 'changelogs.json'), catalog)
  console.log(`Finalized ${version} with all three installers`)
}

function finalEntry(version, state) {
  parseVersion(version)
  const { packageData, changelogs } = state
  if (changelogs[0]?.version !== version || packageData.version !== version) {
    throw new Error('The first catalog version, package.json version and argument must match')
  }
  validateCatalog(changelogs)
  const entry = changelogs[0]
  if (!hasExactKeys(entry, ['version', 'published_at', 'notes', 'assets'])) {
    throw new Error('The final catalog entry must contain version, published_at, notes and assets')
  }
  validateAssets(entry.assets, version)
  assertNewVersion(version, changelogs.slice(1))
  return entry
}

async function verifyFinal(version, artifactDir, mergeSha) {
  parseVersion(version)
  validateCommit(mergeSha, 'mergeSha')
  assertClean()
  git('ls-files', '--error-unmatch', '--', 'package.json', 'changelogs.json')
  const [head, ...parents] = git('rev-list', '--parents', '-n', '1', 'HEAD').trim().split(' ')
  if (parents.length !== 1 || parents[0] !== mergeSha) {
    throw new Error('Final release commit must have mergeSha as its only parent')
  }
  if (tagCommit(version) !== head) throw new Error(`Tag v${version} must already point to HEAD`)
  const changed = git('diff', '--name-only', '-z', '--no-renames', `${mergeSha}..${head}`, '--')
    .split('\0')
    .filter(Boolean)
  if (!isDeepStrictEqual(changed.sort(), ['changelogs.json', 'package.json'])) {
    throw new Error('Final release commit must change only package.json and changelogs.json')
  }
  if (git('diff', '--summary', mergeSha, head, '--')) {
    throw new Error('Final release commit must not change file modes or rename files')
  }
  const merged = readState(mergeSha)
  const draft = validateDraft(version, merged, mergeSha)
  const current = readState(head)
  const entry = finalEntry(version, current)
  if (current.packageText !== replacePackageVersion(merged.packageText, version)) {
    throw new Error('Final package.json must change only the version value')
  }
  if (!isDeepStrictEqual(draft.notes, entry.notes)) {
    throw new Error('Final release notes must equal the merged draft')
  }
  if (!isDeepStrictEqual(merged.changelogs.slice(1), current.changelogs.slice(1))) {
    throw new Error('Historical changelog records must remain unchanged')
  }
  const assets = await readArtifacts(version, artifactDir)
  if (!isDeepStrictEqual(assets, entry.assets)) {
    throw new Error('Installer names, sizes and SHA-256 hashes must match the final catalog')
  }
  console.log(`Verified published ${version} at ${head}`)
}

function repositoryName(packageData) {
  let repository = process.env.GITHUB_REPOSITORY
  if (repository === undefined) {
    const url = packageData.repository?.url
    const match =
      typeof url === 'string' &&
      /^(?:git\+)?https:\/\/github\.com\/([^/?#\s]+\/[^/?#\s]+?)(?:\.git)?$/.exec(url)
    if (!match || match[0] !== url)
      throw new Error('package.repository.url must be a GitHub HTTPS URL')
    repository = match[1]
  }
  const match = /^([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d._-]{1,100})$/i.exec(repository)
  if (!match || match[0] !== repository || ['.', '..'].includes(match[2])) {
    throw new Error('GITHUB_REPOSITORY must be a strict owner/repo name')
  }
  return repository
}

function renderBody(version) {
  const state = readState()
  const entry = finalEntry(version, state)
  const repository = repositoryName(state.packageData)
  const downloads = Object.entries(PLATFORMS).map(([platform, { label }]) => {
    const name = entry.assets[platform].name
    return `- [${label}](https://github.com/${repository}/releases/download/v${version}/${encodeURIComponent(name)})`
  })
  return `${entry.notes.en.map((note) => `- ${note}`).join('\n')}\n\n## Downloads\n\n${downloads.join('\n')}`
}

function packageMac() {
  if (process.platform !== 'darwin') throw new Error('macOS packaging must run on macOS')
  const required = [
    'DEVELOPER_ID_CERTIFICATE_P12',
    'DEVELOPER_ID_CERTIFICATE_PASSWORD',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER_ID',
  ]
  for (const name of required) {
    if (!process.env[name]) throw new Error(`${name} is required for macOS packaging`)
  }
  const keyFile = join(process.env.RUNNER_TEMP ?? tmpdir(), `notary-key-${process.pid}`)
  writeFileSync(keyFile, process.env.APPLE_API_KEY, { mode: 0o600 })
  try {
    run(
      'pnpm',
      [
        'exec',
        'electron-builder',
        '--mac',
        'dmg',
        '--universal',
        '--publish',
        'never',
        '--config.forceCodeSigning=true',
        '--config.mac.hardenedRuntime=true',
        '--config.mac.notarize=true',
        '--config.dmg.sign=true',
      ],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          CSC_LINK: process.env.DEVELOPER_ID_CERTIFICATE_P12,
          CSC_KEY_PASSWORD: process.env.DEVELOPER_ID_CERTIFICATE_PASSWORD,
          APPLE_API_KEY: keyFile,
          APPLE_API_KEY_ID: process.env.APPLE_API_KEY_ID,
          APPLE_API_ISSUER: process.env.APPLE_API_ISSUER_ID,
        },
      }
    )
    const app = 'dist/mac-universal/浮槎.app'
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' })
    run('xcrun', ['stapler', 'validate', app], { stdio: 'inherit' })
    run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app], { stdio: 'inherit' })
    const dmgs = readdirSync(join(ROOT, 'dist')).filter((name) => name.endsWith('.dmg'))
    if (dmgs.length !== 1) throw new Error('Expected exactly one macOS DMG')
    const dmg = join(ROOT, 'dist', dmgs[0])
    run('codesign', ['--verify', '--strict', '--verbose=2', dmg], { stdio: 'inherit' })
    run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', dmg], {
      stdio: 'inherit',
    })
    console.log(`Signed and notarized ${dmgs[0]}`)
  } finally {
    rmSync(keyFile, { force: true })
  }
}

async function publish(artifactDir) {
  const version = process.env.VERSION
  const mergeSha = process.env.RELEASE_SHA
  parseVersion(version)
  validateCommit(mergeSha, 'mergeSha')
  if (!process.env.GH_TOKEN || !process.env.GH_REPO) {
    throw new Error('GH_TOKEN and GH_REPO are required for publication')
  }
  git('fetch', 'origin', 'main', '--tags')
  const tag = `v${version}`
  if (tagCommit(version)) {
    git('switch', '--detach', tag)
    await verifyFinal(version, artifactDir, mergeSha)
  } else {
    const originMain = git('rev-parse', 'refs/remotes/origin/main').trim()
    if (originMain !== mergeSha || git('rev-parse', 'HEAD').trim() !== mergeSha) {
      throw new Error('main advanced after review; prepare a new release PR')
    }
    await finalize(version, artifactDir)
    git('add', 'package.json', 'changelogs.json')
    git(
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=github-actions[bot]@users.noreply.github.com',
      'commit',
      '-m',
      `chore: release ${tag}`
    )
    git('tag', tag)
    git('push', '--atomic', 'origin', 'HEAD:refs/heads/main', `refs/tags/${tag}`)
  }

  const bodyFile = join(process.env.RUNNER_TEMP ?? tmpdir(), 'release-body.md')
  writeFileSync(bodyFile, renderBody(version))
  if (gh(['release', 'view', tag, '--json', 'url'], true) === null) {
    gh([
      'release',
      'create',
      tag,
      '--verify-tag',
      '--title',
      tag,
      '--notes-file',
      bodyFile,
      '--draft',
    ])
  }
  gh([
    'release',
    'upload',
    tag,
    join(artifactDir, `fucha-${version}-mac-universal.dmg`),
    join(artifactDir, `fucha-${version}-win-x64-setup.exe`),
    join(artifactDir, `fucha-${version}-linux-x64.AppImage`),
    '--clobber',
  ])
  gh(['release', 'edit', tag, '--notes-file', bodyFile, '--draft=false'])
  const url = gh(['release', 'view', tag, '--json', 'url', '--jq', '.url']).trim()
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## [Fucha ${tag}](${url})\n\n${renderBody(version)}\n`
    )
  }
  console.log(url)
}

function confirmMerge(version) {
  const { head } = validateMerge(version)
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(resolve(ROOT, process.env.GITHUB_OUTPUT), `version=${version}\n`)
  }
  console.log(`Confirmed ${version} at ${head}`)
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const commands = {
    'confirm-merge': [confirmMerge, 1],
    'stage-version': [stageVersion, 1],
    package: [packageMac, 0],
    finalize: [finalize, 2],
    'verify-final': [verifyFinal, 3],
    body: [(version) => console.log(renderBody(version)), 1],
    publish: [publish, 1],
  }
  if (!Object.hasOwn(commands, command)) throw new Error(`Unknown command: ${command}`)
  const [execute, count] = commands[command]
  if (args.length !== count || args.some((argument) => !argument)) {
    throw new Error(
      'Usage: release.mjs confirm-merge <version> | stage-version <version> | package | finalize <version> <artifactDir> | verify-final <version> <artifactDir> <mergeSha> | body <version> | publish <artifactDir>'
    )
  }
  await execute(...args)
}

main().catch((error) => {
  console.error(`Release error: ${error.message}`)
  process.exitCode = 1
})
