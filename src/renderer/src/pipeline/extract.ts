import type { Article, ImageAsset } from '@shared/types'
import { Readability } from '@mozilla/readability'
import { matchProfile } from '@shared/profiles'
import { sanitizeHtml } from './sanitize'
import { inlineSvgStyles } from './svg'

/** 正文置信度阈值：低于该字符数视为非文章页 */
const MIN_TEXT_LENGTH = 200

/** 正文无法提取时抛出，message 直接展示在错误态 */
export class ExtractError extends Error {}

function metaContent(doc: Document, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    const el = doc.querySelector(sel)
    const value = el?.getAttribute('content') ?? el?.getAttribute('datetime')
    if (value?.trim()) return value.trim()
  }
  return undefined
}

function extractPublishedAt(doc: Document): string | undefined {
  return (
    metaContent(doc, [
      'meta[property="article:published_time"]',
      'meta[name="publishdate"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
      'meta[itemprop="datePublished"]',
      'time[datetime]',
    ]) ?? undefined
  )
}

function extractCover(doc: Document): string | undefined {
  return metaContent(doc, ['meta[property="og:image"]', 'meta[name="twitter:image"]'])
}

/** 微信等站点：图片真实地址在 data-src，先映射回 src 再交给后续流程 */
function applyImageProfile(doc: Document, url: string): void {
  const attr = matchProfile(url)?.imageSourceAttr
  if (!attr) return
  doc.querySelectorAll('img').forEach((img) => {
    const real = img.getAttribute(attr)
    if (real && (!img.getAttribute('src') || img.getAttribute('src')?.startsWith('data:'))) {
      img.setAttribute('src', real)
    }
  })
}

/** 从 HTML 提取正文与元信息，无法提取时抛 ExtractError */
export function extractArticle(html: string, url: string): Article {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  applyImageProfile(doc, url)
  inlineSvgStyles(doc)

  const cover = extractCover(doc)
  const publishedAt = extractPublishedAt(doc)

  const parsed = new Readability(doc.cloneNode(true) as Document).parse()
  if (!parsed?.content) {
    throw new ExtractError('未能在页面中定位到正文，该链接可能不是文章页')
  }

  const textLength = (parsed.textContent ?? '').trim().length
  if (textLength < MIN_TEXT_LENGTH) {
    throw new ExtractError('正文过短，该链接可能不是文章页')
  }

  const sanitizedHtml = sanitizeHtml(parsed.content)
  if (!sanitizedHtml.trim()) {
    throw new ExtractError('正文净化后为空，该链接可能包含不支持的内容')
  }

  const images = collectImages(sanitizedHtml)
  return {
    title: parsed.title?.trim() || doc.title.trim() || '无标题',
    author: parsed.byline?.trim() || undefined,
    publishedAt,
    sourceUrl: url,
    cover,
    html: sanitizedHtml,
    images,
  }
}

function collectImages(html: string): ImageAsset[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const seen = new Set<string>()
  const images: ImageAsset[] = []
  doc.querySelectorAll('img').forEach((img, i) => {
    const src = img.getAttribute('src')
    if (!src || !/^https?:\/\//.test(src) || seen.has(src)) return
    seen.add(src)
    images.push({
      id: `img-${i}-${Date.now().toString(36)}`,
      originalUrl: src,
      status: 'pending',
    })
  })
  return images
}

// 改提取器后整页重载，路由里的 ?url= 会让预览页自动重跑管线。
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload())
}
