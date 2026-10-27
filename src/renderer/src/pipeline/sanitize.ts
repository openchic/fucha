import DOMPurify from 'dompurify'
import { hasOnlyLocalReferences, SVG_NAMESPACE, SVG_STYLE_PROPERTIES } from './svg'

// 语义结构白名单：保留段落/标题/列表/引用/代码块/表格/图片/静态 SVG，其余剥除。
const ALLOWED_TAGS = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'img',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'br',
  'hr',
  'figure',
  'figcaption',
  'span',
  'sup',
  'sub',
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'marker',
  'pattern',
  'title',
  'desc',
]

const FORBID_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'select',
  'textarea',
  'video',
  'audio',
  'math',
  'noscript',
  'template',
]

const ALLOWED_ATTR = [
  'href',
  'src',
  'alt',
  'title',
  'class',
  'colspan',
  'rowspan',
  'datetime',
  'id',
  'role',
  'viewbox',
  'preserveaspectratio',
  'xmlns',
  'x',
  'y',
  'width',
  'height',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-miterlimit',
  'opacity',
  'color',
  'display',
  'visibility',
  'overflow',
  'transform',
  'transform-origin',
  'clip-path',
  'clip-rule',
  'clippathunits',
  'mask',
  'maskunits',
  'mask-type',
  'marker-start',
  'marker-mid',
  'marker-end',
  'markerwidth',
  'markerheight',
  'markerunits',
  'orient',
  'refx',
  'refy',
  'patternunits',
  'patterncontentunits',
  'patterntransform',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'fx',
  'fy',
  'offset',
  'stop-color',
  'stop-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'word-spacing',
  'text-decoration',
  'direction',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  'text-rendering',
  'image-rendering',
  'pointer-events',
  'style',
]

const SVG_URL_ATTRS = [
  'fill',
  'stroke',
  'clip-path',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
]

function keepOnlyLocalPaintReferences(element: Element, attribute: string): void {
  const value = element.getAttribute(attribute)
  if (value !== null && !hasOnlyLocalReferences(value)) {
    element.removeAttribute(attribute)
  }
}

function keepOnlySafeStyle(element: Element): void {
  const style = element.getAttribute('style')
  if (style === null) return
  const declarations = style.split(';').flatMap((declaration) => {
    const separator = declaration.indexOf(':')
    if (separator < 0) return []
    const property = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    if (!SVG_STYLE_PROPERTIES.has(property) || !value || !hasOnlyLocalReferences(value)) return []
    return [`${property}: ${value}`]
  })
  if (declarations.length > 0) {
    element.setAttribute('style', declarations.join('; '))
  } else {
    element.removeAttribute('style')
  }
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (!(node instanceof Element)) return
  if (node.namespaceURI !== SVG_NAMESPACE) {
    node.removeAttribute('style')
    return
  }
  node.removeAttribute('class')
  keepOnlySafeStyle(node)
  for (const attribute of SVG_URL_ATTRS) keepOnlyLocalPaintReferences(node, attribute)
  if (node.localName !== 'a') {
    const href = node.getAttribute('href')
    if (href !== null && !href.trim().startsWith('#')) node.removeAttribute('href')
  }
})

/** 白名单净化正文，保留语义结构与静态 SVG，剥离脚本、事件与外链资源 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    FORBID_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}
