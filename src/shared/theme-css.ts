/** 微信可接受的样式属性；导出过滤与主题 CSS 校验共用同一份白名单 */
export const WECHAT_STYLE_PROPERTIES = new Set([
  'background-color',
  'border',
  'border-bottom',
  'border-bottom-color',
  'border-bottom-style',
  'border-bottom-width',
  'border-collapse',
  'border-color',
  'border-left',
  'border-left-color',
  'border-left-style',
  'border-left-width',
  'quote-border-radius',
  'quote-font-size',
  'image-border-radius',
  'code-border-radius',
  'code-inline-border-radius',
  'code-font-size',
  'border-radius',
  'border-right',
  'border-right-color',
  'border-right-style',
  'border-right-width',
  'border-style',
  'border-top',
  'border-top-color',
  'border-top-style',
  'border-top-width',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'border-width',
  'color',
  'display',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'list-style-type',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-width',
  'min-width',
  'overflow-x',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'text-indent',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
])

export const SAFE_DISPLAY_VALUES = new Set([
  'block',
  'inline',
  'inline-block',
  'list-item',
  'none',
  'table',
  'table-cell',
  'table-row',
])

/** 主题 CSS 可以引用的 token 变量；内部变量（如 text-list-gap）不对外开放 */
export const THEME_CSS_VARIABLES = new Set([
  'primary',
  'quote-background-color',
  'quote-border-left-style',
  'table-header-background-color',
  'divider-border-top-color',
  'border-color',
  'text-font-size',
  'text-secondary-font-size',
  'text-line-height',
  'text-letter-spacing',
  'text-margin-bottom',
  'text-color',
  'text-secondary-color',
  'h1-font-size',
  'h2-font-size',
  'h3-font-size',
  'h4-font-size',
  'h5-font-size',
  'h6-font-size',
  'h1-font-weight',
  'h2-font-weight',
  'h3-font-weight',
  'h4-font-weight',
  'h5-font-weight',
  'h6-font-weight',
  'h1-line-height',
  'h2-line-height',
  'h3-line-height',
  'h4-line-height',
  'h5-line-height',
  'h6-line-height',
  'h1-color',
  'h2-color',
  'h3-color',
  'h4-color',
  'h5-color',
  'h6-color',
  'h1-text-align',
  'h2-text-align',
  'h3-text-align',
  'h4-text-align',
  'h5-text-align',
  'h6-text-align',
  'h1-margin-top',
  'h2-margin-top',
  'h3-margin-top',
  'h4-margin-top',
  'h5-margin-top',
  'h6-margin-top',
  'h1-margin-bottom',
  'h2-margin-bottom',
  'h3-margin-bottom',
  'h4-margin-bottom',
  'h5-margin-bottom',
  'h6-margin-bottom',
  'quote-padding-block',
  'quote-padding-inline',
  'code-line-height',
  'code-padding-block',
  'code-padding-inline',
  'code-background-color',
  'code-border-style',
  'code-caption-border-bottom-style',
  'code-caption-border-bottom-color',
  'code-inline-background-color',
  'table-padding-block',
  'table-padding-inline',
  'image-margin-top',
  'image-margin-bottom',
  'divider-border-top-style',
  'divider-margin-top',
  'divider-margin-bottom',
  'page-padding-top',
  'page-padding-right',
  'page-padding-bottom',
  'page-padding-left',
])

const SELECTOR_PATTERN =
  /^(?:[a-z][a-z0-9-]*|\.[a-z_-][a-z0-9_-]*)(?:\s+(?:[a-z][a-z0-9-]*|\.[a-z_-][a-z0-9_-]*))*$/i

export type CssRule = {
  selector: string
  declarations: string
  line: number
}

function lineOf(css: string, index: number): number {
  return css.slice(0, index).split('\n').length
}

function fail(css: string, index: number, reason: string): never {
  throw new Error(`theme.css 第 ${lineOf(css, index)} 行：${reason}`)
}

function failLine(line: number, reason: string): never {
  throw new Error(`theme.css 第 ${line} 行：${reason}`)
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
}

/** 把 CSS 拆成规则；只接受扁平的 `selector { declarations }` 结构 */
export function parseCssRules(css: string, validateSelectors = false): CssRule[] {
  const source = stripComments(css)
  const rules: CssRule[] = []
  let index = 0

  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index]!)) index += 1
    if (index >= source.length) break

    const open = source.indexOf('{', index)
    if (open < 0) fail(source, index, '缺少左花括号')
    const selector = source.slice(index, open).trim()
    const line = lineOf(source, index)
    if (!selector) fail(source, index, '选择器不能为空')
    if (selector.includes('@')) fail(source, index, '不允许 @ 规则')
    if (!validateSelectors) {
      const close = source.indexOf('}', open + 1)
      if (close < 0) fail(source, open, '缺少右花括号')
      rules.push({ selector, declarations: source.slice(open + 1, close), line })
      index = close + 1
      continue
    }
    if (selector.includes('>') || selector.includes('+') || selector.includes('~')) {
      fail(source, index, '只允许元素、类与后代选择器')
    }
    for (const part of selector.split(',')) {
      const candidate = part.trim()
      if (candidate.includes('&')) {
        if (selector.trim() !== '&') fail(source, index, '`&` 只能单独使用')
        continue
      }
      if (!candidate || !SELECTOR_PATTERN.test(candidate)) {
        fail(source, index, `选择器「${candidate || '空'}」不合法`)
      }
    }

    const close = source.indexOf('}', open + 1)
    if (close < 0) fail(source, open, '缺少右花括号')
    const declarations = source.slice(open + 1, close)
    if (declarations.includes('{') || declarations.includes('}')) {
      fail(source, open, '不允许嵌套规则')
    }
    rules.push({ selector, declarations, line })
    index = close + 1
  }

  if (!source.trim()) return []
  return rules
}

function splitDeclarations(rule: CssRule): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | null = null
  let depth = 0
  for (const char of rule.declarations) {
    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ';' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  if (quote) failLine(rule.line, '字符串引号未闭合')
  if (depth !== 0) failLine(rule.line, '括号未闭合')
  if (current.trim()) parts.push(current)
  return parts
}

function validateValue(rule: CssRule, property: string, value: string): void {
  const lower = value.toLowerCase()
  if (lower.includes('!important')) failLine(rule.line, `${rule.selector} 不允许 !important`)
  if (lower.includes('url(')) failLine(rule.line, `${rule.selector} 不允许外部资源 url()`)
  if (lower.includes('expression(') || lower.includes('javascript:')) {
    failLine(rule.line, `${rule.selector} 含不安全的值`)
  }
  if (property === 'display' && !SAFE_DISPLAY_VALUES.has(lower)) {
    failLine(
      rule.line,
      `${rule.selector} 的 display 只允许 ${[...SAFE_DISPLAY_VALUES].join(' / ')}`
    )
  }
  for (const match of lower.matchAll(/var\(\s*--fucha-([a-z0-9-]+)\s*\)/g)) {
    if (!THEME_CSS_VARIABLES.has(match[1]!)) {
      failLine(rule.line, `${rule.selector} 引用了不存在的变量 --fucha-${match[1]}`)
    }
  }
  if (/var\(/.test(lower.replace(/var\(\s*--fucha-[a-z0-9-]+\s*\)/g, ''))) {
    failLine(rule.line, `${rule.selector} 只能引用 token 契约内的变量`)
  }
}

/** 导入或保存主题 CSS 前的 fail-closed 校验；返回原 CSS */
export function validateThemeCss(css: string): string {
  if (/[<>]/.test(css)) failLine(1, 'CSS 不能包含 < 或 >')
  for (const rule of parseCssRules(css, true)) {
    for (const declaration of splitDeclarations(rule)) {
      const separator = declaration.indexOf(':')
      if (separator < 0) failLine(rule.line, `${rule.selector} 的声明缺少冒号`)
      const property = declaration.slice(0, separator).trim().toLowerCase()
      const value = declaration.slice(separator + 1).trim()
      if (!property) failLine(rule.line, `${rule.selector} 的声明缺少属性名`)
      if (!WECHAT_STYLE_PROPERTIES.has(property)) {
        failLine(rule.line, `${rule.selector} 使用了微信不支持的属性 ${property}`)
      }
      if (!value) failLine(rule.line, `${rule.selector} 的 ${property} 缺少值`)
      validateValue(rule, property, value)
    }
  }
  return css
}

/** `&` 是文章根节点选择器；这里取出它的声明，供预览与导出外层节点使用 */
export function themeRootDeclarations(css: string): string {
  return parseCssRules(css)
    .filter((rule) => rule.selector.trim() === '&')
    .map((rule) => rule.declarations.trim())
    .filter((declarations) => declarations && declarations !== ';')
    .map((declarations) => (declarations.endsWith(';') ? declarations : `${declarations};`))
    .join('\n')
}

/** 去掉 `&` 根规则后的 theme.css；作用域化与 juice 只处理普通选择器 */
export function withoutThemeRootRules(css: string): string {
  return parseCssRules(css)
    .filter((rule) => rule.selector.trim() !== '&')
    .map((rule) => `${rule.selector} {${rule.declarations}}`)
    .join('\n\n')
}

/** 预览路径：给每条规则加上 .article-body 作用域；`&` 规则由调用方写到根节点 */
export function scopeCss(css: string, scope: string): string {
  const rules = parseCssRules(css).filter((rule) => rule.selector.trim() !== '&')
  return rules
    .map((rule) => {
      const selector = rule.selector
        .split(',')
        .map((part) => `${scope} ${part.trim()}`)
        .join(', ')
      return `${selector} {${rule.declarations}}`
    })
    .join('\n\n')
}

/** 导出路径：把 token 变量替换成具体值，juice 不解析 CSS 变量 */
export function resolveThemeVariables(css: string, values: Record<string, string>): string {
  return css.replace(/var\(\s*--fucha-([a-z0-9-]+)\s*\)/g, (_match, name: string) => {
    const value = values[name]
    if (value === undefined) throw new Error(`未定义的 token 变量 --fucha-${name}`)
    return value
  })
}
