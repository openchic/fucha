import type { Article, ThemeDefinition } from '@shared/types'
import { SAFE_DISPLAY_VALUES, WECHAT_STYLE_PROPERTIES } from '@shared/theme-css'
import juice from 'juice'
import { buildExportCss, exportRootStyle } from '../theme/apply'
import { highlightArticleHtml } from '../theme/highlight'
import { normalizeArticleDom } from './normalize'

function prepareExportBody(article: Article): string {
  const doc = new DOMParser().parseFromString(highlightArticleHtml(article.html), 'text/html')
  normalizeArticleDom(doc, article.title)
  doc.querySelectorAll('a').forEach((anchor) => {
    anchor.replaceWith(...Array.from(anchor.childNodes))
  })
  return doc.body.innerHTML
}

function filterWechatStyles(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style, link, script').forEach((node) => node.remove())

  doc.querySelectorAll('[style]').forEach((element) => {
    const style = (element as HTMLElement).style
    for (const property of Array.from(style)) {
      const value = style.getPropertyValue(property).trim()
      const allowed =
        WECHAT_STYLE_PROPERTIES.has(property) &&
        !value.includes('var(') &&
        (property !== 'display' || SAFE_DISPLAY_VALUES.has(value))
      if (!allowed) style.removeProperty(property)
    }
    if (!style.cssText.trim()) element.removeAttribute('style')
  })

  doc.querySelectorAll('blockquote').forEach((quote) => {
    const last = quote.lastElementChild as HTMLElement | null
    if (last) last.style.marginBottom = '0'
  })

  doc.querySelectorAll('pre').forEach((pre) => {
    if (!(pre as HTMLElement).style.overflowX) (pre as HTMLElement).style.overflowX = 'auto'
  })

  return doc.body.innerHTML
}

/**
 * 渲染器侧导出：高亮、去外链、juice 内联、微信属性过滤。
 * 图片仍保留原始地址，由主进程 exportHtml 换成 base64。
 */
export function buildExportHtml(article: Article, theme: ThemeDefinition): string {
  const prepared = prepareExportBody(article)
  const css = buildExportCss(theme)
  const inlined = juice.inlineContent(prepared, css, {
    applyAttributesTableElements: false,
    applyHeightAttributes: false,
    applyStyleTags: false,
    applyWidthAttributes: false,
    inlinePseudoElements: false,
    preserveFontFaces: false,
    preserveKeyFrames: false,
    preserveMediaQueries: false,
    removeStyleTags: true,
    resolveCSSVariables: false,
  })
  const cleaned = filterWechatStyles(inlined)
  return `<section style="${exportRootStyle(theme.token)}">${cleaned}</section>`
}

/** 剪贴板纯文本兜底：按块级边界保留可读换行 */
export function exportHtmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr').forEach((node) => {
    node.append('\n')
  })
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}
