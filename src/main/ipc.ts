import type { DownloadImagesPayload, FetchResult, ImageDownloadResult } from '@shared/types'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import { join, normalize, resolve, sep } from 'path'
import { app, ipcMain, protocol } from 'electron'
import { looksLikeCaptcha, matchProfile } from '@shared/profiles'

const FETCH_TIMEOUT_MS = 15_000
const IMAGE_TIMEOUT_MS = 20_000
const IMAGE_CONCURRENCY = 3
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export function articleCacheDir(): string {
  return join(app.getPath('userData'), 'article-cache')
}

// ---------- fucha:// 本地图片协议 ----------

/** 必须在 app ready 之前调用 */
export function registerFuchaProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'fucha',
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
export function serveFuchaProtocol(): void {
  protocol.handle('fucha', async (request) => {
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

function classifyFetchError(error: unknown): FetchResult {
  if (error instanceof Error && error.name === 'AbortError') {
    return { ok: false, error: { kind: 'timeout', message: '目标服务器超时未响应' } }
  }
  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
  if (code && ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET'].includes(code)) {
    return { ok: false, error: { kind: 'network', message: '网络不可达或域名无法解析' } }
  }
  return {
    ok: false,
    error: { kind: 'network', message: error instanceof Error ? error.message : String(error) },
  }
}

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
  item: { id: string; originalUrl: string }
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

// ---------- IPC 接线 ----------

export function registerIpcHandlers(): void {
  ipcMain.handle('fetch-article', (_event, url: string) => fetchArticle(url))
  ipcMain.handle('download-images', (_event, payload: DownloadImagesPayload) =>
    downloadImages(payload)
  )
}
