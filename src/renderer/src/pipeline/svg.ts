const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

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

const UNSAFE_STYLE_VALUE = /[\\<>]|expression\s*\(|@import|!important|var\s*\(/i

export function hasOnlyLocalReferences(value: string): boolean {
  if (UNSAFE_STYLE_VALUE.test(value)) return false
  if (!/url\s*\(/i.test(value)) return true
  const referencePattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi
  const references = Array.from(value.matchAll(referencePattern), (match) => match[2].trim())
  const remainder = value.replace(referencePattern, '')
  return !/url\s*\(/i.test(remainder) && references.every((reference) => reference.startsWith('#'))
}

function safeDeclarations(style: CSSStyleDeclaration): [string, string][] {
  const declarations: [string, string][] = []
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index).toLowerCase()
    const value = style.getPropertyValue(property).trim()
    if (!SVG_STYLE_PROPERTIES.has(property) || !value || !hasOnlyLocalReferences(value)) continue
    declarations.push([property, value])
  }
  return declarations
}

// Readability 会清理全文 style 与 class，必须在提取前把 SVG 内部样式落到元素上。
export function inlineSvgStyles(root: ParentNode): void {
  const doc = root instanceof Document ? root : root.ownerDocument
  if (!doc) return
  const styleElements = Array.from(doc.querySelectorAll('style'))
  const svgs = Array.from(doc.querySelectorAll('svg'))
  if (styleElements.length === 0 || svgs.length === 0) return

  const rules: { selector: string; declarations: [string, string][] }[] = []
  for (const styleElement of styleElements) {
    let sheet: CSSStyleSheet
    try {
      sheet = new CSSStyleSheet()
      sheet.replaceSync(styleElement.textContent ?? '')
    } catch {
      continue
    }
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSStyleRule)) continue
      const declarations = safeDeclarations(rule.style)
      if (declarations.length > 0) rules.push({ selector: rule.selectorText, declarations })
    }
  }
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
