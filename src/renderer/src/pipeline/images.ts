import type { Article, ImageDownloadResult } from '@shared/types'

/** 占位图是 data URI，读不到文档的 CSS 变量，颜色按 article.css 的 surface 与 soft 基线写死 */
function placeholder(label: string): string {
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#f6f7f8"/><text x="50%" y="50%" fill="#6b7280" font-family="system-ui" font-size="20" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
    )
  )
}

const PENDING_PLACEHOLDER = placeholder('图片加载中')
const FAILED_PLACEHOLDER = placeholder('图片加载失败')

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** 重写正文图片地址为本地缓存或占位图，返回可注入的 HTML */
export function renderPreviewHtml(
  article: Article,
  articleHash: string,
  results: ImageDownloadResult[]
): string {
  const byId = new Map(results.map((result) => [result.id, result]))
  const doc = new DOMParser().parseFromString(article.html, 'text/html')
  const first = doc.body.firstElementChild
  if (
    (first?.tagName === 'H1' || first?.tagName === 'H2') &&
    normalizeText(first.textContent ?? '') === normalizeText(article.title)
  ) {
    first.remove()
  }
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src')
    if (!src) return
    const asset = article.images.find((item) => item.originalUrl === src)
    if (!asset) return
    const result = byId.get(asset.id)
    if (result?.status === 'done' && result.file) {
      img.setAttribute('src', `fucha://img/${articleHash}/${result.file}`)
    } else {
      img.setAttribute('src', result ? FAILED_PLACEHOLDER : PENDING_PLACEHOLDER)
    }
    img.setAttribute('loading', 'lazy')
  })
  return doc.body.innerHTML
}
