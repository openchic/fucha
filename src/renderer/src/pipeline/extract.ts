import type { Article, ImageAsset } from '@shared/types'
import { Readability } from '@mozilla/readability'
import { matchProfile } from '@shared/profiles'
import { sanitizeHtml } from './sanitize'
import {
  collectEmbeddedSvgFonts,
  inlineSvgStyles,
  normalizeSvgTextLinePositions,
  preserveSvgHeadings,
} from './svg'

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

/** 以最终地址作为文档 base，Readability 按 doc.baseURI 解析相对图片与链接 */
function applyBaseUrl(doc: Document, url: string): void {
  doc.querySelectorAll('base').forEach((node) => node.remove())
  const base = doc.createElement('base')
  base.setAttribute('href', url)
  doc.head.prepend(base)
}

/** 微信等站点：正文容器先被内联隐藏，提取前解除，否则 Readability 会判为不可见 */
function revealProfileContent(doc: Document, url: string): void {
  const selectors = matchProfile(url)?.revealSelectors
  if (!selectors) return
  for (const selector of selectors) {
    doc.querySelectorAll(selector).forEach((node) => {
      const style = (node as HTMLElement).style
      style.visibility = ''
      style.opacity = ''
    })
  }
}

/** 站点级清理：提前删除不影响判定的控件，标记参与判定但不应出现在正文中的组件 */
function dropProfileChrome(doc: Document, url: string): void {
  const profile = matchProfile(url)
  if (!profile) return
  for (const selector of profile.dropSelectors ?? []) {
    doc.querySelectorAll(selector).forEach((node) => node.remove())
  }
  for (const selector of profile.postDropSelectors ?? []) {
    doc.querySelectorAll(selector).forEach((node) => node.setAttribute('data-fucha-chrome', ''))
  }
}

function removeProfileChrome(doc: Document): void {
  doc.querySelectorAll('[data-fucha-chrome]').forEach((node) => node.remove())
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
  applyBaseUrl(doc, url)
  revealProfileContent(doc, url)
  dropProfileChrome(doc, url)
  applyImageProfile(doc, url)
  const svgFontFaces = collectEmbeddedSvgFonts(doc)
  preserveSvgHeadings(doc)
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

  const contentDoc = new DOMParser().parseFromString(parsed.content, 'text/html')
  removeProfileChrome(contentDoc)
  normalizeSvgTextLinePositions(contentDoc)
  const sanitizedHtml = sanitizeHtml(contentDoc.body.innerHTML, svgFontFaces)
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
