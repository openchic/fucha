export const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export const SVG_STYLE_PROPERTIES = new Set([
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
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'word-spacing',
  'text-decoration',
  'paint-order',
  'vector-effect',
  'shape-rendering',
  'mix-blend-mode',
])

export interface SvgFontFace {
  family: string
  source: string
  style: string
  weight: string
  unicodeRange?: string
}

const SAFE_FONT_DATA_URL =
  /^data:(?:font\/(?:woff2?|ttf|otf|collection)|application\/(?:font-woff2?|x-font-ttf|x-font-opentype|vnd\.ms-fontobject))(?:;charset=[a-z0-9._-]+)?;base64,[a-z0-9+/]+={0,2}$/i
const MAX_EMBEDDED_FONT_DATA_URL_LENGTH = 2_000_000
const MAX_EMBEDDED_FONT_FACES = 16

const SVG_HEADING_TAGS = 'h1, h2, h3, h4, h5, h6'
const SVG_HEADING_FONT_SCALE: Record<string, number> = {
  h1: 0.62,
  h2: 0.46,
  h3: 0.38,
  h4: 0.34,
  h5: 0.3,
  h6: 0.27,
}
const SVG_HEADING_STYLE_PROPERTIES = new Set([
  ...SVG_STYLE_PROPERTIES,
  'border-bottom',
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-width',
  'font',
])
const SVG_HEADING_INHERITED_PROPERTIES = new Set([
  'color',
  'fill',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'letter-spacing',
  'text-decoration',
  'word-spacing',
])
const SVG_HEADING_LINE_PROPERTIES = new Set([
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-width',
])

function numericAttribute(element: Element, name: string): number | null {
  const rawValue = element.getAttribute(name)
  if (rawValue === null || rawValue.trim() === '') return null
  const value = Number(rawValue)
  return Number.isFinite(value) ? value : null
}

/** 将简单 SVG 多行文本的相对 dy 转成白名单支持的绝对 y 坐标。 */
export function normalizeSvgTextLinePositions(root: ParentNode): void {
  for (const text of root.querySelectorAll('svg text')) {
    const baseY = numericAttribute(text, 'y')
    const tspans = Array.from(text.children)
    if (
      baseY === null ||
      tspans.length === 0 ||
      tspans.some(
        (tspan) =>
          tspan.namespaceURI !== SVG_NAMESPACE ||
          tspan.localName !== 'tspan' ||
          Array.from(tspan.children).length > 0
      )
    ) {
      continue
    }

    let currentY = baseY
    for (const tspan of tspans) {
      const y = numericAttribute(tspan, 'y')
      const dy = numericAttribute(tspan, 'dy')
      if (tspan.hasAttribute('y') && y === null) break
      if (tspan.hasAttribute('dy') && dy === null) break

      if (y !== null) currentY = y
      else if (dy !== null) currentY += dy

      if (y !== null || dy !== null) {
        tspan.setAttribute('y', String(currentY))
        tspan.removeAttribute('dy')
      }
    }
  }
}

function hasOnlyHeadingTextContent(root: Element, heading: Element): boolean {
  const visit = (node: Node): boolean => {
    if (node === heading) return true
    if (node.nodeType === Node.TEXT_NODE) return !(node.textContent ?? '').trim()
    return Array.from(node.childNodes).every(visit)
  }
  return visit(root)
}

function plainHeadingText(heading: Element): string | null {
  const inlineTags = new Set(['span', 'strong', 'b', 'em', 'i', 'u', 'small', 'code'])
  const readNode = (node: Node): string | null => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
    if (node.nodeType === Node.COMMENT_NODE) return ''
    if (node.nodeType !== Node.ELEMENT_NODE) return null

    const element = node as Element
    if (
      element.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      !inlineTags.has(element.localName.toLowerCase())
    ) {
      return null
    }

    let content = ''
    for (const child of Array.from(element.childNodes)) {
      const childText = readNode(child)
      if (childText === null) return null
      content += childText
    }
    return content
  }

  let content = ''
  for (const child of Array.from(heading.childNodes)) {
    const childText = readNode(child)
    if (childText === null) return null
    content += childText
  }
  return content.replace(/\s+/g, ' ').trim()
}

const UNSAFE_STYLE_VALUE = /[\\<>]|expression\s*\(|@import|!important|var\s*\(/i

/** 只允许 `#` 本地引用，拦下外链与可执行表达式 */
export function hasOnlyLocalReferences(value: string): boolean {
  if (UNSAFE_STYLE_VALUE.test(value)) return false
  if (!/url\s*\(/i.test(value)) return true
  const referencePattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
  const references = Array.from(value.matchAll(referencePattern), (match) => match[2].trim())
  const remainder = value.replace(referencePattern, '')
  return !/url\s*\(/i.test(remainder) && references.every((reference) => reference.startsWith('#'))
}

function collectCssVariables(style: CSSStyleDeclaration, variables: Map<string, string>): void {
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index)
    if (!property.startsWith('--')) continue
    const value = style.getPropertyValue(property).trim()
    if (value) variables.set(property, value)
  }
}

function resolveCssVariables(value: string, variables: Map<string, string>, depth = 0): string {
  if (depth > 8 || !value.includes('var(')) return value
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (match, name, fallback) => {
    const replacement = variables.get(name) ?? fallback?.trim()
    return replacement === undefined
      ? match
      : resolveCssVariables(replacement, variables, depth + 1)
  })
}

function safeDeclarations(
  style: CSSStyleDeclaration,
  allowedProperties: Set<string> = SVG_STYLE_PROPERTIES,
  document?: Document,
  variables?: Map<string, string>
): [string, string][] {
  const declarations: [string, string][] = []

  const expand = (property: string, value: string): void => {
    if (!document) return
    const expandedStyle = document.createElement('span').style
    expandedStyle.setProperty(property, value)
    const expandedProperties =
      property === 'border-bottom'
        ? SVG_HEADING_LINE_PROPERTIES
        : new Set(['font-family', 'font-size', 'font-style', 'font-weight'])
    for (const expandedProperty of expandedProperties) {
      const expandedValue = expandedStyle.getPropertyValue(expandedProperty).trim()
      if (expandedValue && hasOnlyLocalReferences(expandedValue)) {
        declarations.push([expandedProperty, expandedValue])
      }
    }
  }

  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index).toLowerCase()
    const rawValue = style.getPropertyValue(property).trim()
    const value = variables ? resolveCssVariables(rawValue, variables) : rawValue
    if (!allowedProperties.has(property) || !value || !hasOnlyLocalReferences(value)) continue
    if (property === 'border-bottom' || property === 'font') {
      expand(property, value)
      continue
    }
    declarations.push([property, value])
  }

  // Shorthands containing var() are not exposed as longhands by CSSStyleDeclaration.
  for (const property of ['border-bottom', 'font']) {
    if (!allowedProperties.has(property) || !document) continue
    const rawValue = style.getPropertyValue(property).trim()
    const value = variables ? resolveCssVariables(rawValue, variables) : rawValue
    if (!value || !hasOnlyLocalReferences(value)) continue
    expand(property, value)
  }

  return declarations
}

function readStyleRules(doc: Document): { selector: string; style: CSSStyleDeclaration }[] {
  const rules: { selector: string; style: CSSStyleDeclaration }[] = []
  for (const styleElement of Array.from(doc.querySelectorAll('style'))) {
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(styleElement.textContent ?? '')
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSStyleRule)
          rules.push({ selector: rule.selectorText, style: rule.style })
      }
    } catch {
      // Invalid or unsupported source styles do not affect the static SVG output.
    }
  }
  return rules
}

function readEmbeddedSvgFontFaces(doc: Document): SvgFontFace[] {
  const fontFaces: SvgFontFace[] = []
  const seen = new Set<string>()
  for (const styleElement of Array.from(doc.querySelectorAll('style'))) {
    try {
      const sheet = new CSSStyleSheet()
      sheet.replaceSync(styleElement.textContent ?? '')
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.type !== CSSRule.FONT_FACE_RULE || fontFaces.length >= MAX_EMBEDDED_FONT_FACES) {
          continue
        }

        const style = (rule as CSSFontFaceRule).style
        const familyValue = style.getPropertyValue('font-family').trim()
        const family = familyValue.replace(/^(?:"([^"]+)"|'([^']+)')$/, '$1$2')
        if (!/^[a-z0-9_-]{1,128}$/i.test(family)) continue

        const sourceValue = style.getPropertyValue('src')
        const source = Array.from(
          sourceValue.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\s)]+))\s*\)/gi),
          (match) => match[1] ?? match[2] ?? match[3]
        ).find(
          (candidate) =>
            candidate.length <= MAX_EMBEDDED_FONT_DATA_URL_LENGTH &&
            SAFE_FONT_DATA_URL.test(candidate)
        )
        if (!source) continue

        const fontStyle = style.getPropertyValue('font-style').trim() || 'normal'
        const fontWeight = style.getPropertyValue('font-weight').trim() || 'normal'
        const unicodeRange = style.getPropertyValue('unicode-range').trim()
        if (!/^(?:normal|italic|oblique)$/i.test(fontStyle)) continue
        if (!/^(?:normal|bold|[1-9]00(?:\s+[1-9]00)?)$/i.test(fontWeight)) continue
        if (
          unicodeRange &&
          !/^(?:u\+[0-9a-f?]{1,6}(?:-[0-9a-f]{1,6})?)(?:\s*,\s*u\+[0-9a-f?]{1,6}(?:-[0-9a-f]{1,6})?)*$/i.test(
            unicodeRange
          )
        ) {
          continue
        }

        const key = `${family}|${fontStyle}|${fontWeight}|${unicodeRange}|${source}`
        if (seen.has(key)) continue
        seen.add(key)
        fontFaces.push({ family, source, style: fontStyle, weight: fontWeight, unicodeRange })
      }
    } catch {
      // Invalid or unsupported source styles cannot contribute embedded fonts.
    }
  }
  return fontFaces
}

function svgFontFamilies(svg: Element): Set<string> {
  const families = new Set<string>()
  const elements = [svg, ...Array.from(svg.querySelectorAll('*'))]
  for (const element of elements) {
    const attribute = element.getAttribute('font-family')
    const inlineStyle = element.getAttribute('style')
    const style = inlineStyle ? element.ownerDocument.createElement('span').style : null
    if (style && inlineStyle) style.cssText = inlineStyle
    const value = attribute ?? style?.getPropertyValue('font-family') ?? ''
    for (const familyValue of value.split(',')) {
      const family = familyValue.trim().replace(/^(?:"([^"]+)"|'([^']+)')$/, '$1$2')
      if (family) families.add(family.toLowerCase())
    }
  }
  return families
}

/** 只提取 data: 内嵌字体；调用方会在最终净化后的 SVG 中再按需注入。 */
export function collectEmbeddedSvgFonts(root: ParentNode): SvgFontFace[] {
  const doc = root instanceof Document ? root : root.ownerDocument
  return doc ? readEmbeddedSvgFontFaces(doc) : []
}

/** 在净化之后，只把 SVG 实际使用的安全内嵌字体写回对应 SVG。 */
export function appendSafeSvgFontFaces(root: ParentNode, fontFaces: SvgFontFace[]): void {
  if (fontFaces.length === 0) return
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const families = svgFontFamilies(svg)
    const matchingFaces = fontFaces.filter((fontFace) =>
      families.has(fontFace.family.toLowerCase())
    )
    if (matchingFaces.length === 0) continue

    const style = svg.ownerDocument.createElementNS(SVG_NAMESPACE, 'style')
    style.textContent = matchingFaces
      .map((fontFace) => {
        const unicodeRange = fontFace.unicodeRange ? `;unicode-range:${fontFace.unicodeRange}` : ''
        return `@font-face{font-family:"${fontFace.family}";src:url("${fontFace.source}");font-style:${fontFace.style};font-weight:${fontFace.weight}${unicodeRange}}`
      })
      .join('')
    svg.insertBefore(style, svg.firstChild)
  }
}

function headingPresentationStyles(
  heading: Element,
  rules: { selector: string; style: CSSStyleDeclaration }[]
): Map<string, string> {
  const ancestors: Element[] = []
  let current: Element | null = heading
  while (current) {
    ancestors.push(current)
    if (current.namespaceURI === SVG_NAMESPACE && current.localName === 'svg') break
    current = current.parentElement
  }

  const ordered = ancestors.reverse()
  const variables = new Map<string, string>()
  const inlineStyles = new Map<Element, CSSStyleDeclaration>()

  for (const element of ordered) {
    for (const rule of rules) {
      let matches = false
      try {
        matches = element.matches(rule.selector)
      } catch {
        continue
      }
      if (matches) collectCssVariables(rule.style, variables)
    }

    const inlineStyle = element.getAttribute('style')
    if (!inlineStyle) continue
    const style = element.ownerDocument.createElement('span').style
    style.cssText = inlineStyle
    collectCssVariables(style, variables)
    inlineStyles.set(element, style)
  }

  const styles = new Map<string, string>()
  for (const element of ordered) {
    for (const rule of rules) {
      let matches = false
      try {
        matches = element.matches(rule.selector)
      } catch {
        continue
      }
      if (!matches) continue

      for (const [property, value] of safeDeclarations(
        rule.style,
        SVG_HEADING_STYLE_PROPERTIES,
        element.ownerDocument,
        variables
      )) {
        if (
          SVG_HEADING_INHERITED_PROPERTIES.has(property) ||
          (element === heading && SVG_HEADING_LINE_PROPERTIES.has(property))
        ) {
          styles.set(property, value)
        }
      }
    }

    const style = inlineStyles.get(element)
    if (!style) continue
    for (const [property, value] of safeDeclarations(
      style,
      SVG_HEADING_STYLE_PROPERTIES,
      element.ownerDocument,
      variables
    )) {
      if (
        SVG_HEADING_INHERITED_PROPERTIES.has(property) ||
        (element === heading && SVG_HEADING_LINE_PROPERTIES.has(property))
      ) {
        styles.set(property, value)
      }
    }
  }

  return styles
}

/** Readability 会清理全文 style 与 class，必须在提取前把 SVG 内部样式落到元素上 */
export function inlineSvgStyles(root: ParentNode): void {
  const doc = root instanceof Document ? root : root.ownerDocument
  if (!doc) return
  const styleElements = Array.from(doc.querySelectorAll('style'))
  const svgs = Array.from(doc.querySelectorAll('svg'))
  if (styleElements.length === 0 || svgs.length === 0) return

  const rules = readStyleRules(doc)
    .map(({ selector, style }) => ({
      selector,
      declarations: safeDeclarations(style, SVG_STYLE_PROPERTIES, doc),
    }))
    .filter((rule) => rule.declarations.length > 0)
  for (const styleElement of styleElements) {
    if (styleElement.closest('svg')) styleElement.remove()
  }
  if (rules.length === 0) return

  for (const svg of svgs) {
    const elements = [svg, ...Array.from(svg.querySelectorAll('*'))].filter(
      (element): element is SVGElement =>
        element instanceof SVGElement && element.namespaceURI === SVG_NAMESPACE
    )
    const originalInlineStyles = new Map<SVGElement, [string, string, string][]>()
    for (const element of elements) {
      const declarations: [string, string, string][] = []
      for (let index = 0; index < element.style.length; index += 1) {
        const property = element.style.item(index)
        declarations.push([
          property,
          element.style.getPropertyValue(property),
          element.style.getPropertyPriority(property),
        ])
      }
      if (declarations.length > 0) originalInlineStyles.set(element, declarations)
    }

    for (const element of elements) {
      for (const rule of rules) {
        let matches = false
        try {
          matches = element.matches(rule.selector)
        } catch {
          continue
        }
        if (!matches) continue
        for (const [property, value] of rule.declarations) {
          element.style.setProperty(property, value)
        }
      }
    }

    for (const [element, declarations] of originalInlineStyles) {
      for (const [property, value, priority] of declarations) {
        element.style.setProperty(property, value, priority)
      }
    }
  }
}

const SVG_BLACK_FILLS = new Set([
  '#000',
  '#000000',
  'black',
  'rgb(0,0,0)',
  'rgb(0, 0, 0)',
  'rgba(0,0,0,1)',
  'rgba(0, 0, 0, 1)',
])

function svgNumber(element: Element, name: string): number | null {
  const raw = element.getAttribute(name)
  if (raw === null || raw.trim() === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function isSolidBlackRect(element: Element): element is SVGRectElement {
  if (element.namespaceURI !== SVG_NAMESPACE || element.localName !== 'rect') return false
  if (element.hasAttribute('transform')) return false
  const opacity = element.getAttribute('fill-opacity')
  if (opacity !== null && Number(opacity) !== 1) return false
  const fill = (element.getAttribute('fill') ?? '').trim().toLowerCase()
  return SVG_BLACK_FILLS.has(fill)
}

function normalizeMaskReference(value: string | null): string | null {
  if (!value) return null
  const match = value.trim().match(/^url\(\s*['"]?#([^'")]+)['"]?\s*\)$/i)
  return match?.[1] ?? null
}

function svgBackgroundColor(svg: Element, fallback: string): string {
  for (const child of Array.from(svg.children)) {
    if (child.namespaceURI !== SVG_NAMESPACE || child.localName !== 'rect') continue
    const fill = child.getAttribute('fill')?.trim()
    if (!fill || fill === 'none' || fill === 'transparent') continue
    if ((svgNumber(child, 'width') ?? 0) > 0 && (svgNumber(child, 'height') ?? 0) > 0) return fill
  }
  return fallback
}

function rectContainsText(rect: Element, text: Element): boolean {
  const x = svgNumber(text, 'x')
  const y = svgNumber(text, 'y')
  const rx = svgNumber(rect, 'x')
  const ry = svgNumber(rect, 'y')
  const width = svgNumber(rect, 'width')
  const height = svgNumber(rect, 'height')
  if (x === null || y === null || rx === null || ry === null || width === null || height === null) {
    return false
  }
  return x >= rx && x <= rx + width && y >= ry - 4 && y <= ry + height + 8
}

/**
 * 微信保存会丢失 SVG mask。把「实色 rect mask」烘成显式底色矩形：
 * 在对应标签文字前插入一块底色，盖住穿过的箭头/生命线，再移除 mask。
 * 只处理只含 rect、无 transform、黑色镂空的简单 mask；其他 mask 保持原样。
 */
export function bakeSvgMasksForExport(root: ParentNode, fallbackBackground = '#ffffff'): void {
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    const masks = Array.from(svg.querySelectorAll('mask'))
    if (masks.length === 0) continue
    const background = svgBackgroundColor(svg, fallbackBackground)
    const texts = Array.from(svg.querySelectorAll('text'))

    for (const mask of masks) {
      const id = mask.getAttribute('id')
      if (!id) continue
      const children = Array.from(mask.querySelectorAll('*'))
      if (children.some((child) => child.localName !== 'rect' || child.hasAttribute('transform'))) {
        continue
      }
      const holes = children.filter(isSolidBlackRect)
      if (holes.length === 0) continue

      const used = Array.from(svg.querySelectorAll('*')).filter(
        (element) => normalizeMaskReference(element.getAttribute('mask')) === id
      )
      if (used.length === 0) continue
      const lastUsed = used[used.length - 1]

      for (const hole of holes) {
        const x = svgNumber(hole, 'x')
        const y = svgNumber(hole, 'y')
        const width = svgNumber(hole, 'width')
        const height = svgNumber(hole, 'height')
        if (x === null || y === null || width === null || height === null) continue

        const document = svg.ownerDocument
        if (!document) continue
        const cover = document.createElementNS(SVG_NAMESPACE, 'rect')
        cover.setAttribute('x', String(x))
        cover.setAttribute('y', String(y))
        cover.setAttribute('width', String(width))
        cover.setAttribute('height', String(height))
        cover.setAttribute('fill', background)
        const radius = hole.getAttribute('rx')
        if (radius) cover.setAttribute('rx', radius)

        const label = texts.find((text) => rectContainsText(hole, text))
        const parent = label?.parentElement ?? lastUsed?.parentElement
        if (!parent) continue
        parent.insertBefore(cover, label ?? lastUsed.nextSibling)
      }

      for (const element of used) element.removeAttribute('mask')
      mask.remove()
    }
  }
}

/** 只有 viewBox 的 SVG 在微信里可能被裁；补上从 viewBox 推导的宽高 */
export function ensureSvgSizeAttributes(root: ParentNode): void {
  for (const svg of Array.from(root.querySelectorAll('svg'))) {
    if (svg.hasAttribute('width') && svg.hasAttribute('height')) continue
    const viewBox = svg.getAttribute('viewBox')
    if (!viewBox) continue
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (values.length !== 4) continue
    const width = values[2]
    const height = values[3]
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue
    if (!svg.hasAttribute('width')) svg.setAttribute('width', String(width))
    if (!svg.hasAttribute('height')) svg.setAttribute('height', String(height))
  }
}

/** Preserve plain SVG headings as vector text before removing their foreignObject wrappers. */
export function preserveSvgHeadings(root: ParentNode): void {
  const doc = root instanceof Document ? root : root.ownerDocument
  if (!doc) return
  const rules = readStyleRules(doc)
  const foreignObjects = Array.from(root.querySelectorAll('svg *')).filter(
    (element) =>
      element.namespaceURI === SVG_NAMESPACE && element.localName.toLowerCase() === 'foreignobject'
  )

  for (const foreignObject of foreignObjects) {
    const headings = Array.from(foreignObject.querySelectorAll(SVG_HEADING_TAGS))
    if (headings.length !== 1) continue

    const heading = headings[0]
    if (
      heading.namespaceURI !== 'http://www.w3.org/1999/xhtml' ||
      !hasOnlyHeadingTextContent(foreignObject, heading)
    ) {
      continue
    }

    const textContent = plainHeadingText(heading)
    const x = numericAttribute(foreignObject, 'x')
    const y = numericAttribute(foreignObject, 'y')
    const width = numericAttribute(foreignObject, 'width')
    const height = numericAttribute(foreignObject, 'height')
    if (
      !textContent ||
      x === null ||
      y === null ||
      width === null ||
      height === null ||
      width <= 0 ||
      height <= 0
    ) {
      continue
    }

    const document = foreignObject.ownerDocument
    const text = document.createElementNS(SVG_NAMESPACE, 'text')
    const fontSize = Math.round(height * (SVG_HEADING_FONT_SCALE[heading.localName] ?? 0.34))
    const styles = headingPresentationStyles(heading, rules)
    text.setAttribute('x', String(x + width / 2))
    text.setAttribute('y', String(y + height / 2))
    text.setAttribute('dominant-baseline', 'middle')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('font-size', styles.get('font-size') ?? String(fontSize))
    text.setAttribute('font-weight', styles.get('font-weight') ?? '600')
    text.setAttribute('fill', 'currentColor')
    for (const property of SVG_HEADING_INHERITED_PROPERTIES) {
      const value = styles.get(property)
      if (value) text.setAttribute(property, value)
    }
    text.textContent = textContent

    if (heading.localName === 'h1') {
      const lineStyle = styles.get('border-bottom-style')
      if (!lineStyle || lineStyle === 'none' || styles.get('border-bottom-width') === '0px') {
        foreignObject.replaceWith(text)
        continue
      }

      const underline = document.createElementNS(SVG_NAMESPACE, 'line')
      underline.setAttribute('x1', String(x))
      underline.setAttribute('x2', String(x + width))
      underline.setAttribute('y1', String(y + height - 1))
      underline.setAttribute('y2', String(y + height - 1))
      underline.setAttribute('stroke', styles.get('border-bottom-color') ?? 'currentColor')
      underline.setAttribute('stroke-width', styles.get('border-bottom-width') ?? '1')
      if (lineStyle === 'dashed') underline.setAttribute('stroke-dasharray', '4 3')
      if (lineStyle === 'dotted') underline.setAttribute('stroke-dasharray', '1 2')
      foreignObject.replaceWith(text, underline)
    } else {
      foreignObject.replaceWith(text)
    }
  }
}
