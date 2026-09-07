import type { Article, ThemeDefinition } from '@shared/types'
import { SAFE_DISPLAY_VALUES, WECHAT_STYLE_PROPERTIES } from '@shared/theme-css'
import juice from 'juice'
import { buildExportCss, buildExportRootStyle } from '../theme/apply'
import { highlightArticleHtml } from '../theme/highlight'
import { normalizeArticleDom } from './normalize'
import { promoteSvgPresentationStyles } from './sanitize'
import { bakeSvgMasksForExport, ensureSvgSizeAttributes } from './svg'

const LIST_BLOCK_SELECTOR = 'p, div, ul, ol, pre, figure, table, blockquote, section'

/**
 * 微信会把列表首项粗体后面的内容包进块级 section，导致说明另起一行。
 * 首项粗体改为行内 span，并把整项内容包进无外边距的 p，让 section 包住整段。
 */
function inlineListLeadBold(doc: Document): void {
  doc.querySelectorAll('li').forEach((item) => {
    if (item.querySelector(LIST_BLOCK_SELECTOR)) return
    const first = item.firstElementChild
    if (!first || (first.localName !== 'strong' && first.localName !== 'b')) return
    const span = doc.createElement('span')
    span.setAttribute('style', 'font-weight: 700')
    while (first.firstChild) span.append(first.firstChild)
    first.replaceWith(span)
    const paragraph = doc.createElement('p')
    paragraph.setAttribute('style', 'margin: 0')
    while (item.firstChild) paragraph.append(item.firstChild)
    item.append(paragraph)
  })
}

function prepareExportBody(article: Article, pageBackground?: string): string {
  const doc = new DOMParser().parseFromString(highlightArticleHtml(article.html), 'text/html')
  normalizeArticleDom(doc, article.title)
  doc.querySelectorAll('a').forEach((anchor) => {
    anchor.replaceWith(...Array.from(anchor.childNodes))
  })
  inlineListLeadBold(doc)
  promoteSvgPresentationStyles(doc)
  bakeSvgMasksForExport(doc, pageBackground ?? '#ffffff')
  ensureSvgSizeAttributes(doc)
  return doc.body.innerHTML
}

/** 根 style 含主题 CSS，拼入 HTML 属性前必须转义，避免引号截断属性 */
function escapeStyleAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 代码文本里的空格与缩进改成不可折叠空格，换行仍保留为文本/br，供下一步按行拆块 */
function normalizeCodeText(doc: Document, code: HTMLElement): void {
  const walker = doc.createTreeWalker(code, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text)
  }
  for (const node of textNodes) {
    const value = node.nodeValue ?? ''
    if (!value.includes(' ') && !value.includes('\t') && !value.includes('\n')) continue
    const normalized = value
      .replace(/\r\n?/g, '\n')
      .replace(/\t/g, '\u00a0\u00a0\u00a0\u00a0')
      .replace(/ /g, '\u00a0')
    const fragment = doc.createDocumentFragment()
    normalized.split('\n').forEach((line, index) => {
      if (index) fragment.append(doc.createElement('br'))
      if (line) fragment.append(doc.createTextNode(line))
    })
    node.replaceWith(fragment)
  }
}

/** 每行成为 width:max-content 的块：宽度由内容决定，微信丢掉 white-space 也不会折行 */
function splitCodeLines(doc: Document, code: HTMLElement): void {
  const lines: Node[][] = [[]]
  for (const child of Array.from(code.childNodes)) {
    if (child.nodeName === 'BR') {
      child.remove()
      lines.push([])
      continue
    }
    lines[lines.length - 1]!.push(child)
  }
  const fragment = doc.createDocumentFragment()
  for (const nodes of lines) {
    const line = doc.createElement('span')
    line.setAttribute('data-code-line', '')
    line.style.display = 'block'
    line.style.width = 'max-content'
    line.style.whiteSpace = 'pre'
    if (nodes.length) {
      for (const node of nodes) line.append(node)
    } else {
      line.append(doc.createTextNode('\u00a0'))
    }
    fragment.append(line)
  }
  code.replaceChildren(fragment)
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

  // 微信正文全局限制 max-width:100% 且会重写 pre 的空白；代码块把每行拆成
  // width:max-content 的块，行宽由内容决定，即使 white-space 被丢弃也不会折行
  doc.querySelectorAll('pre').forEach((pre) => {
    const element = pre as HTMLElement
    element.style.setProperty('white-space', 'normal', 'important')
    element.style.setProperty('overflow-x', 'auto', 'important')
    element.style.setProperty('max-width', '1000%', 'important')
  })

  doc.querySelectorAll('pre code').forEach((code) => {
    const element = code as HTMLElement
    element.style.setProperty('display', 'block', 'important')
    // 让 code 撑到最宽行，滚动条回到 pre 底部，与预览一致；被微信丢弃时回退到 code 自身滚动
    element.style.setProperty('width', 'max-content', 'important')
    element.style.setProperty('overflow-x', 'auto', 'important')
    element.style.setProperty('white-space', 'normal', 'important')
    element.style.setProperty('max-width', '1000%', 'important')
    normalizeCodeText(doc, element)
    splitCodeLines(doc, element)
    element.querySelectorAll('*').forEach((child) => {
      ;(child as HTMLElement).style.setProperty('max-width', '1000%', 'important')
    })
  })

  // 微信会给 blockquote 叠加默认左条；导出改为带同样内联样式的 section
  doc.querySelectorAll('blockquote').forEach((quote) => {
    const last = quote.lastElementChild as HTMLElement | null
    if (last) last.style.marginBottom = '0'
    const section = doc.createElement('section')
    for (const attribute of Array.from(quote.attributes)) {
      section.setAttribute(attribute.name, attribute.value)
    }
    while (quote.firstChild) section.append(quote.firstChild)
    quote.replaceWith(section)
  })

  return doc.body.innerHTML
}

/**
 * 渲染器侧导出：高亮、去外链、juice 内联、微信属性过滤。
 * 图片仍保留原始地址，由主进程 exportHtml 换成 base64。
 */
export function buildExportHtml(article: Article, theme: ThemeDefinition): string {
  const prepared = prepareExportBody(article, theme.token.page.backgroundColor)
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
  return `<section style="${escapeStyleAttribute(buildExportRootStyle(theme))}">${cleaned}</section>`
}

/** 剪贴板纯文本兜底：按块级边界保留可读换行 */
export function exportHtmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  doc
    .querySelectorAll(
      'p, h1, h2, h3, h4, h5, h6, li, blockquote, section, pre, tr, [data-code-line]'
    )
    .forEach((node) => {
      node.append('\n')
    })
  return (doc.body.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
