import type { Article } from '@shared/types'

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
export function renderPreviewHtml(article: Article): string {
  const byUrl = new Map(article.images.map((asset) => [asset.originalUrl, asset]))
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
    const asset = byUrl.get(src)
    if (!asset) return
    img.dataset.fuchaImageId = asset.id
    img.setAttribute('src', PENDING_PLACEHOLDER)
    img.setAttribute('loading', 'lazy')
  })
  return doc.body.innerHTML
}

/** 更新已渲染的图片节点，避免图片下载完成时替换整篇正文 */
export function updatePreviewImages(
  root: HTMLElement | null,
  article: Article,
  articleHash: string
): void {
  if (!root) return

  const assetsById = new Map(article.images.map((asset) => [asset.id, asset]))
  root.querySelectorAll<HTMLImageElement>('img[data-fucha-image-id]').forEach((img) => {
    const asset = assetsById.get(img.dataset.fuchaImageId ?? '')
    if (!asset) return

    const nextSrc =
      asset.status === 'done' && asset.localPath
        ? `fucha://img/${articleHash}/${asset.localPath}`
        : asset.status === 'failed'
          ? FAILED_PLACEHOLDER
          : PENDING_PLACEHOLDER

    if (img.getAttribute('src') !== nextSrc) img.setAttribute('src', nextSrc)
  })
}
