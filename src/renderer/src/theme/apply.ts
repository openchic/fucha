import type { ThemeDefinition, ThemeToken } from '@shared/types'
import { HEADING_KEYS } from '@shared/theme'
import {
  resolveThemeVariables,
  scopeCss,
  themeRootDeclarations,
  withoutThemeRootRules,
} from '@shared/theme-css'
import { BASE_CSS } from './base-css'
import { highlightThemeBackground, highlightThemeCss } from './highlight'

/** 预览画布常量，不进入 token，也不参与导出 */
export const PREVIEW_CONTENT_WIDTH = 676
/** 微信正文自带的左右留白；预览用它模拟平台边距，导出由平台提供 */
export const PLATFORM_SIDE_PADDING = 20
export const ARTICLE_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"

const SCOPED_BASE_CSS = scopeCss(BASE_CSS, '.article-body')

/** token 到 CSS 变量；text-list-gap 是内部变量，不向 theme.css 开放 */
export function tokenVariables(token: ThemeToken): Record<string, string> {
  const values: Record<string, string> = {
    primary: token.primary,
    'quote-background-color': token.quote.backgroundColor,
    'quote-border-left-style': token.quote.decoration === 'bar' ? 'solid' : 'none',
    'table-header-background-color': token.table.headerBackgroundColor,
    'border-color': token.borderColor,
    'quote-border-radius': `${token.quote.borderRadius}px`,
    'quote-font-size': `${token.quote.fontSize}px`,
    'image-border-radius': `${token.image.borderRadius}px`,
    'code-border-radius': `${token.code.borderRadius}px`,
    'code-inline-border-radius': `${token.code.inlineBorderRadius}px`,
    'code-font-size': `${token.code.fontSize}px`,
    'text-font-size': `${token.text.fontSize}px`,
    'text-secondary-font-size': `${token.text.secondaryFontSize}px`,
    'text-line-height': String(token.text.lineHeight),
    'text-letter-spacing': `${token.text.letterSpacing}em`,
    'text-margin-bottom': `${token.text.marginBottom}px`,
    'text-list-gap': `${Math.max(4, Math.round(token.text.marginBottom / 2))}px`,
    'text-color': token.text.color,
    'text-secondary-color': token.text.secondaryColor,
    'quote-padding-block': `${token.quote.paddingBlock}px`,
    'quote-padding-inline': `${token.quote.paddingInline}px`,
    'code-line-height': String(token.code.lineHeight),
    'code-padding-block': `${token.code.paddingBlock}px`,
    'code-padding-inline': `${token.code.paddingInline}px`,
    'code-background-color':
      token.code.backgroundColor ?? highlightThemeBackground(token.code.hljsTheme),
    'code-border-style': token.code.borderStyle,
    'code-caption-border-bottom-style': token.code.captionDivider.borderBottomStyle,
    'code-caption-border-bottom-color':
      token.code.captionDivider.borderBottomColor ?? token.borderColor,
    'code-inline-background-color': token.code.inlineBackgroundColor,
    'table-padding-block': `${token.table.paddingBlock}px`,
    'table-padding-inline': `${token.table.paddingInline}px`,
    'image-margin-top': `${token.image.marginTop}px`,
    'image-margin-bottom': `${token.image.marginBottom}px`,
    'divider-border-top-style': token.divider.borderTopStyle,
    'divider-border-top-color': token.divider.borderTopColor,
    'divider-margin-top': `${token.divider.marginTop}px`,
    'divider-margin-bottom': `${token.divider.marginBottom}px`,
    'page-background-color': token.page.backgroundColor ?? 'transparent',
    'page-padding-top': `${token.page.paddingTop}px`,
    'page-padding-right': `${token.page.paddingRight}px`,
    'page-padding-bottom': `${token.page.paddingBottom}px`,
    'page-padding-left': `${token.page.paddingLeft}px`,
  }

  for (const key of HEADING_KEYS) {
    values[`${key}-font-size`] = `${token[key].fontSize}px`
    values[`${key}-font-weight`] = String(token[key].fontWeight)
    values[`${key}-line-height`] = String(token[key].lineHeight)
    values[`${key}-color`] = token.headingColor
    values[`${key}-text-align`] = token[key].textAlign
    values[`${key}-margin-top`] = `${token[key].marginTop}px`
    values[`${key}-margin-bottom`] = `${token[key].marginBottom}px`
  }

  return values
}

/** 标题装饰只用真实边框，微信会剥离伪元素 */
function decorationCss(token: ThemeToken): string {
  return HEADING_KEYS.map((key) => {
    const decoration = token[key].decoration
    if (decoration === 'none') return ''
    const border = `var(--theme-primary)`
    if (decoration === 'bar') {
      return `${key} {\n  border-left: 3px solid ${border};\n  padding-left: 12px;\n}`
    }
    if (decoration === 'underline') {
      return `${key} {\n  border-bottom: 2px solid ${border};\n  padding-bottom: 6px;\n}`
    }
    return `${key} {\n  border-left: 2px solid ${border};\n  border-right: 2px solid ${border};\n  padding: 0 10px;\n}`
  })
    .filter(Boolean)
    .join('\n\n')
}

function previewCanvas(): string {
  return [
    `  max-width: calc(${PREVIEW_CONTENT_WIDTH}px + var(--theme-page-padding-left) + var(--theme-page-padding-right) + ${PLATFORM_SIDE_PADDING * 2}px);`,
    '  margin: 0 auto;',
    `  padding: var(--theme-page-padding-top) calc(var(--theme-page-padding-right) + ${PLATFORM_SIDE_PADDING}px) var(--theme-page-padding-bottom) calc(var(--theme-page-padding-left) + ${PLATFORM_SIDE_PADDING}px);`,
    '  background-color: var(--theme-page-background-color);',
    '  min-height: 100%;',
    `  font-family: ${ARTICLE_FONT_FAMILY};`,
    '  font-size: var(--theme-text-font-size);',
    '  line-height: var(--theme-text-line-height);',
    '  letter-spacing: var(--theme-text-letter-spacing);',
    '  color: var(--theme-text-color);',
    '  word-break: break-word;',
    '  text-align: left;',
  ].join('\n')
}

function scopedThemeCss(theme: ThemeDefinition): string {
  const themeCss = [
    decorationCss(theme.token),
    highlightThemeCss(theme.token.code.hljsTheme),
    withoutThemeRootRules(theme.css),
  ]
    .filter(Boolean)
    .join('\n\n')
  return themeCss ? scopeCss(themeCss, '.article-body') : ''
}

/** `&` 根规则追加到根节点，保持与 base 同选择器、后写覆盖 */
function rootDeclarationsOf(theme: ThemeDefinition): string {
  const declarations = themeRootDeclarations(theme.css)
  return declarations ? `\n${declarations}` : ''
}

/** 预览：token 变量 + 根规则 + base.css + 装饰 + 语法色 + theme.css，全部限定在 .article-body */
export function buildPreviewCss(theme: ThemeDefinition): string {
  const variables = Object.entries(tokenVariables(theme.token))
    .map(([name, value]) => `  --theme-${name}: ${value};`)
    .join('\n')

  return [
    `.article-body {\n${variables}\n${previewCanvas()}${rootDeclarationsOf(theme)}\n}`,
    SCOPED_BASE_CSS,
    scopedThemeCss(theme),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** 预览静态样式：画布、根规则、base、装饰与语法色；token 变量由预览容器内联，拖动时只改变量 */
export function buildPreviewStyle(theme: ThemeDefinition): string {
  return [
    `.article-body {\n${previewCanvas()}${rootDeclarationsOf(theme)}\n}`,
    SCOPED_BASE_CSS,
    scopedThemeCss(theme),
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** 预览容器内联的 token 变量，键名带 --theme- 前缀 */
export function previewStyleVariables(token: ThemeToken): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokenVariables(token)).map(([name, value]) => [`--theme-${name}`, value])
  )
}

/** 导出：同一份 CSS 去掉作用域并把变量解析成具体值，juice 不解析 var() */
export function buildExportCss(theme: ThemeDefinition): string {
  const token = theme.token
  const css = [
    BASE_CSS,
    decorationCss(token),
    highlightThemeCss(token.code.hljsTheme),
    withoutThemeRootRules(theme.css),
  ]
    .filter(Boolean)
    .join('\n\n')
  return resolveThemeVariables(css, tokenVariables(token))
}

/** 导出外层 section 的基础样式；与预览 .article-body 的字体基线同源 */
export function exportRootStyle(token: ThemeToken, rootDeclarations = ''): string {
  const values = tokenVariables(token)
  const resolvedRoot = rootDeclarations
    ? resolveThemeVariables(rootDeclarations, values).replace(/;\s*$/, '')
    : ''
  return [
    `font-family: ${ARTICLE_FONT_FAMILY}`,
    `font-size: ${values['text-font-size']}`,
    `line-height: ${values['text-line-height']}`,
    `letter-spacing: ${values['text-letter-spacing']}`,
    `color: ${values['text-color']}`,
    ...(token.page.backgroundColor ? [`background-color: ${token.page.backgroundColor}`] : []),
    `padding: ${values['page-padding-top']} ${values['page-padding-right']} ${values['page-padding-bottom']} ${values['page-padding-left']}`,
    'box-sizing: border-box',
    'word-break: break-word',
    'text-align: left',
    resolvedRoot,
  ]
    .filter(Boolean)
    .join('; ')
}

/** 导出外层样式：token 基线 + theme.css 的 `&` 根规则 */
export function buildExportRootStyle(theme: ThemeDefinition): string {
  return exportRootStyle(theme.token, themeRootDeclarations(theme.css))
}
