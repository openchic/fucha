import type {
  CopyHtmlPayload,
  DownloadImagesPayload,
  ExportHtmlPayload,
  FetchResult,
  ImageDownloadResult,
} from '@shared/types'
import type {
  ArticleSnapshotInput,
  JsonValue,
  StoredImageInput,
  ThemeSnapshotInput,
  ThemeUpdateInput,
} from '@shared/store-types'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { join, normalize, resolve, sep } from 'path'
import { app, BrowserWindow, clipboard, ipcMain, protocol } from 'electron'
import { looksLikeCaptcha, matchProfile } from '@shared/profiles'
import { exportThemePackage, importThemePackage } from './theme-package'
import {
  createTheme,
  deleteArticle,
  deleteTheme,
  getArticle,
  getPreference,
  listArticles,
  listThemes,
  replaceArticleImages,
  setArticleTheme,
  setPreference,
  touchArticle,
  updateTheme,
  upsertArticle,
} from './store'

const FETCH_TIMEOUT_MS = 15_000
const IMAGE_TIMEOUT_MS = 20_000
const IMAGE_CONCURRENCY = 3
const EXPORT_IMAGE_LIMIT = 5 * 1024 * 1024
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** 导出占位图：640×360 的浅灰位图，不用 SVG */
const EXPORT_PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAFoCAIAAABIUN0GAAAEgklEQVR42u3VMQ0AAAgEsfcvGBgJJpiaVMEtl+oBAJ5FAgAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYBUAwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIBVAAADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAA5YAAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAxYBQAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADgL3D+spCUhJQ4AAAAASUVORK5CYII='

/** 文章图片与缓存索引的根目录 */
export function articleCacheDir(): string {
  return join(app.getPath('userData'), 'article-cache')
}

// ---------- app:// 本地图片协议 ----------

/** 必须在 app ready 之前调用 */
export function registerAppProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ])
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
}

/** app ready 之后调用；服务 userData/article-cache 下的图片 */
export function serveAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const base = resolve(articleCacheDir())
    const { host, pathname } = new URL(request.url)
    if (host !== 'img') {
      return new Response('not found', { status: 404 })
    }
    // 归一化后必须仍在缓存目录内，防路径穿越
    const file = resolve(base, normalize(decodeURIComponent(pathname).replace(/^\/+/, '')))
    if (!file.startsWith(base + sep)) {
      return new Response('forbidden', { status: 403 })
    }
    const type = MIME_BY_EXT[file.slice(file.lastIndexOf('.'))]
    try {
      const data = await fs.readFile(file)
      return new Response(new Uint8Array(data), {
        headers: type ? { 'content-type': type } : undefined,
      })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
}

// ---------- 抓取 ----------

async function fetchWithTimeout(url: string, timeoutMs: number, headers?: Record<string, string>) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': UA, ...headers },
      redirect: 'follow',
    })
  } finally {
    clearTimeout(timer)
  }
}

function fetchErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const source = 'code' in error ? error : 'cause' in error ? error.cause : undefined
  if (!source || typeof source !== 'object' || !('code' in source)) return undefined
  return String(source.code)
}

function classifyFetchError(error: unknown): FetchResult {
  if (error instanceof Error && error.name === 'AbortError') {
    return { ok: false, error: { kind: 'timeout', message: '目标服务器超时未响应' } }
  }
  const code = fetchErrorCode(error)
  if (code && ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET'].includes(code)) {
    return { ok: false, error: { kind: 'network', message: '网络不可达或域名无法解析' } }
  }
  return { ok: false, error: { kind: 'network', message: '网络请求失败，请稍后重试' } }
}

/** 抓取文章 HTML，失败按原因分类返回 */
export async function fetchArticle(rawUrl: string): Promise<FetchResult> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: { kind: 'network', message: '链接格式不正确' } }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: { kind: 'network', message: '仅支持 http 与 https 链接' } }
  }

  let response: Response
  try {
    response = await fetchWithTimeout(url.toString(), FETCH_TIMEOUT_MS)
  } catch (error) {
    return classifyFetchError(error)
  }
  if (!response.ok) {
    return {
      ok: false,
      error: {
        kind: 'rejected',
        message: `目标服务器拒绝（HTTP ${response.status}）`,
        status: response.status,
      },
    }
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType && !/text\/html|application\/xhtml\+xml|text\/plain/.test(contentType)) {
    return {
      ok: false,
      error: {
        kind: 'rejected',
        message: `链接不是网页（${contentType.split(';')[0]}）`,
        status: response.status,
      },
    }
  }

  const charset = /charset=([\w-]+)/.exec(contentType)?.[1]
  const buffer = await response.arrayBuffer()
  let html: string
  try {
    html = new TextDecoder(charset || 'utf-8').decode(buffer)
  } catch {
    html = new TextDecoder('utf-8').decode(buffer)
  }

  if (looksLikeCaptcha(html, response.url || url.toString())) {
    return {
      ok: false,
      error: { kind: 'captcha', message: '站点要求验证，暂时无法抓取' },
    }
  }

  return { ok: true, html, finalUrl: response.url || url.toString() }
}

// ---------- 图片下载 ----------

function contentHash(buffer: Buffer): string {
  return createHash('sha1').update(buffer).digest('hex')
}

let cacheIndexWrites: Promise<void> = Promise.resolve()

function recordCacheIndex(indexFile: string, originalUrl: string, fileName: string): Promise<void> {
  const update = cacheIndexWrites.then(async () => {
    let index: Record<string, string> = {}
    try {
      index = JSON.parse(await fs.readFile(indexFile, 'utf-8')) as Record<string, string>
    } catch {
      // 索引不存在，从空开始
    }
    index[originalUrl] = fileName
    await fs.writeFile(indexFile, JSON.stringify(index, null, 2))
  })
  cacheIndexWrites = update.catch(() => {})
  return update
}

function extFor(contentType: string | null, url: string): string {
  const byType: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/svg+xml': '.svg',
  }
  if (contentType) {
    const clean = contentType.split(';')[0].trim().toLowerCase()
    if (byType[clean]) return byType[clean]
  }
  const fromUrl = /\.(jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i.exec(url)?.[1]
  return fromUrl ? `.${fromUrl.toLowerCase().replace('jpeg', 'jpg')}` : '.jpg'
}

async function downloadOne(
  articleDir: string,
  item: DownloadImagesPayload['images'][number]
): Promise<ImageDownloadResult> {
  const profile = matchProfile(item.originalUrl)
  const indexFile = join(articleDir, 'index.json')

  // 复用：索引里已有映射且文件存在则跳过网络
  try {
    const index = JSON.parse(await fs.readFile(indexFile, 'utf-8')) as Record<string, string>
    const cached = index[item.originalUrl]
    if (
      cached &&
      (await fs
        .stat(join(articleDir, cached))
        .then(() => true)
        .catch(() => false))
    ) {
      return { id: item.id, status: 'done', file: cached }
    }
  } catch {
    // 索引不存在，正常首次下载
  }

  try {
    const response = await fetchWithTimeout(
      item.originalUrl,
      IMAGE_TIMEOUT_MS,
      profile?.imageHeaders
    )
    if (!response.ok) {
      return { id: item.id, status: 'failed' }
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    // 内容 hash 命名：相同图片在重复提交与跨文章间天然复用
    const fileName = `${contentHash(buffer)}${extFor(response.headers.get('content-type'), item.originalUrl)}`
    await fs.writeFile(join(articleDir, fileName), buffer)
    await recordCacheIndex(indexFile, item.originalUrl, fileName)
    return { id: item.id, status: 'done', file: fileName }
  } catch {
    return { id: item.id, status: 'failed' }
  }
}

/** 按文章归档下载正文图片，返回逐图结果 */
export async function downloadImages(
  payload: DownloadImagesPayload
): Promise<ImageDownloadResult[]> {
  const articleDir = join(articleCacheDir(), payload.articleHash)
  await fs.mkdir(articleDir, { recursive: true })

  const results: ImageDownloadResult[] = []
  const queue = [...payload.images]
  const workers = Array.from({ length: Math.min(IMAGE_CONCURRENCY, queue.length) }, async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) return
      results.push(await downloadOne(articleDir, item))
    }
  })
  await Promise.all(workers)
  return results
}

// ---------- 导出 ----------

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function fileToDataUri(dir: string, file: string): Promise<string | null> {
  if (!/^[a-f0-9]+\.[a-z0-9]+$/i.test(file)) return null
  const filePath = join(dir, file)
  const stat = await fs.stat(filePath)
  if (stat.size > EXPORT_IMAGE_LIMIT) return null
  const data = await fs.readFile(filePath)
  const mime = MIME_BY_EXT[file.slice(file.lastIndexOf('.')).toLowerCase()] ?? 'image/jpeg'
  return `data:${mime};base64,${data.toString('base64')}`
}

/** 把导出 HTML 中的正文图片换成 base64；失败、超限或缺失一律用位图占位 */
export async function exportHtml(payload: ExportHtmlPayload): Promise<string> {
  if (!/^[a-f0-9]{32}$/.test(payload.articleHash)) return payload.html
  const dir = join(articleCacheDir(), payload.articleHash)
  let index: Record<string, string> = {}
  try {
    index = JSON.parse(await fs.readFile(join(dir, 'index.json'), 'utf-8')) as Record<
      string,
      string
    >
  } catch {
    // 没有索引时正文中的外部图片全部降级为占位
  }

  const sources = new Map<string, string>()
  let counter = 0
  const marked = payload.html.replace(
    /(<img\b[^>]*?\bsrc=")([^"]*)(")/gi,
    (match, before: string, src: string, after: string) => {
      if (!src || src.startsWith('data:')) return match
      const token = `__APP_IMAGE_${counter++}__`
      sources.set(token, src)
      return `${before}${token}${after}`
    }
  )

  let result = marked
  for (const [token, src] of sources) {
    const file = index[decodeHtmlEntities(src)]
    let dataUri = EXPORT_PLACEHOLDER
    if (file) {
      dataUri = (await fileToDataUri(dir, file).catch(() => null)) ?? EXPORT_PLACEHOLDER
    }
    result = result.split(token).join(dataUri)
  }
  return result
}

export function copyHtml(payload: CopyHtmlPayload): void {
  clipboard.write({ html: payload.html, text: payload.text })
}

// ---------- IPC 接线 ----------

/** app ready 之后注册抓取、图片下载、存储与导出相关的 IPC 处理器 */
export function registerIpcHandlers(): void {
  ipcMain.handle('fetch-article', (_event, url: string) => fetchArticle(url))
  ipcMain.handle('download-images', (_event, payload: DownloadImagesPayload) =>
    downloadImages(payload)
  )
  ipcMain.handle('export-html', (_event, payload: ExportHtmlPayload) => exportHtml(payload))
  ipcMain.handle('copy-html', (_event, payload: CopyHtmlPayload) => copyHtml(payload))

  ipcMain.handle('themes:list', () => listThemes())
  ipcMain.handle('themes:create', (_event, input: ThemeSnapshotInput) => createTheme(input))
  ipcMain.handle('themes:update', (_event, input: ThemeUpdateInput) => updateTheme(input))
  ipcMain.handle('themes:delete', (_event, id: string) => deleteTheme(id))
  ipcMain.handle('themes:export', (event, input: ThemeSnapshotInput) =>
    exportThemePackage(input, BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )
  ipcMain.handle('themes:import', (event) =>
    importThemePackage(BrowserWindow.fromWebContents(event.sender) ?? undefined)
  )

  ipcMain.handle('preferences:get', (_event, key: string) => getPreference(key) ?? null)
  ipcMain.handle('preferences:set', (_event, key: string, value: JsonValue) => {
    setPreference(key, value)
  })

  ipcMain.handle('articles:list', (_event, limit?: number, offset?: number) =>
    listArticles(limit, offset)
  )
  ipcMain.handle('articles:get', (_event, hash: string) => getArticle(hash) ?? null)
  ipcMain.handle('articles:save', (_event, input: ArticleSnapshotInput) => upsertArticle(input))
  ipcMain.handle('articles:images', (_event, hash: string, images: StoredImageInput[]) =>
    replaceArticleImages(hash, images)
  )
  ipcMain.handle('articles:theme', (_event, hash: string, themeId: string) =>
    setArticleTheme(hash, themeId)
  )
  ipcMain.handle('articles:touch', (_event, hash: string) => touchArticle(hash))
  ipcMain.handle('articles:delete', (_event, hash: string) => deleteArticle(hash))
}
