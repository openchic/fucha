import type { ThemeImportResult, ThemeExportResult } from '@shared/types'
import type { ThemeSnapshotInput } from '@shared/store-types'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  app,
  dialog,
  type BrowserWindow,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from 'electron'
import { THEME_TOKEN_VERSION, validateThemeToken } from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import { createTheme } from './store'
import { createZip, readZip } from './zip'

const PACKAGE_VERSION = '1.0.0'
const PACKAGE_FILES = ['theme.json', 'theme.css'] as const

type ThemePackageJson = {
  id: string
  name: string
  version: string
  tokenVersion: number
  token: unknown
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`theme.json 缺少 ${field}`)
  return value.trim()
}

function parseThemeJson(raw: Buffer): {
  token: ReturnType<typeof validateThemeToken>
  tokenVersion: number
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.toString('utf8'))
  } catch {
    throw new Error('theme.json 不是合法 JSON')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('theme.json 必须是对象')
  }
  const data = parsed as Partial<ThemePackageJson>
  const id = readString(data.id, 'id')
  const name = readString(data.name, 'name')
  readString(data.version, 'version')
  if (data.tokenVersion !== THEME_TOKEN_VERSION) {
    throw new Error(`不支持的主题 token 版本：${String(data.tokenVersion)}`)
  }
  const token = validateThemeToken(data.token)
  if (token.id !== id) throw new Error('theme.json 的 id 与 token.id 不一致')
  if (token.name !== name) throw new Error('theme.json 的 name 与 token.name 不一致')
  if (token.builtin) throw new Error('主题包不能声明为内置主题')
  return { token, tokenVersion: data.tokenVersion }
}

function safeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '-').trim() || 'theme'
}

/** 生成主题包字节；内置主题导出后是普通自定义主题 */
export function buildThemePackage(input: ThemeSnapshotInput): Buffer {
  const token = validateThemeToken({ ...input.token, builtin: false })
  const css = validateThemeCss(input.css)
  const tokenVersion = input.tokenVersion ?? THEME_TOKEN_VERSION
  if (tokenVersion !== THEME_TOKEN_VERSION) {
    throw new Error(`不支持的主题 token 版本：${tokenVersion}`)
  }
  const themeJson: ThemePackageJson = {
    id: token.id,
    name: token.name,
    version: PACKAGE_VERSION,
    tokenVersion,
    token,
  }
  return createZip([
    { name: 'theme.json', data: Buffer.from(JSON.stringify(themeJson, null, 2), 'utf8') },
    { name: 'theme.css', data: Buffer.from(css, 'utf8') },
  ])
}

/** 读取主题包并做 fail-closed 校验，不写入存储 */
export function parseThemePackage(buffer: Buffer): {
  token: ReturnType<typeof validateThemeToken>
  css: string
  tokenVersion: number
} {
  const entries = readZip(buffer)
  for (const name of entries.keys()) {
    if (!(PACKAGE_FILES as readonly string[]).includes(name)) {
      throw new Error(`主题包包含多余文件：${name}`)
    }
  }
  for (const name of PACKAGE_FILES) {
    if (!entries.has(name)) throw new Error(`主题包缺少 ${name}`)
  }

  const { token, tokenVersion } = parseThemeJson(entries.get('theme.json')!)
  const css = validateThemeCss(entries.get('theme.css')!.toString('utf8'))
  return { token, css, tokenVersion }
}

/** 把当前主题写成主题包；文件名取 token.name */
export async function exportThemePackage(
  input: ThemeSnapshotInput,
  parent?: BrowserWindow
): Promise<ThemeExportResult> {
  try {
    const zip = buildThemePackage(input)

    const options: SaveDialogOptions = {
      title: '导出主题包',
      defaultPath: join(app.getPath('documents'), `${safeFileName(input.token.name)}.fucha-theme`),
      filters: [{ name: 'fucha 主题包', extensions: ['fucha-theme'] }],
    }
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return { ok: false, canceled: true }

    const filePath = result.filePath.endsWith('.fucha-theme')
      ? result.filePath
      : `${result.filePath}.fucha-theme`
    await fs.writeFile(filePath, zip)
    return { ok: true, path: filePath }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

/** 读取并校验主题包，成功后直接写入自定义主题表 */
export async function importThemePackage(parent?: BrowserWindow): Promise<ThemeImportResult> {
  try {
    const options: OpenDialogOptions = {
      title: '导入主题包',
      properties: ['openFile'],
      filters: [{ name: 'fucha 主题包', extensions: ['fucha-theme'] }],
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true }

    const buffer = await fs.readFile(result.filePaths[0]!)
    const { token, css, tokenVersion } = parseThemePackage(buffer)
    const theme = createTheme({ token, css, tokenVersion })
    return { ok: true, theme }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}
