import type { ThemeDefinition, ThemeToken } from '@shared/types'
import { HEADING_KEYS, headingColor } from '@shared/theme'
import { resolveThemeVariables, scopeCss } from '@shared/theme-css'
import { BASE_CSS } from './base-css'
import { highlightThemeBackground, highlightThemeCss } from './highlight'

/** 预览画布常量，不进入 token，也不参与导出 */
export const PREVIEW_CONTENT_WIDTH = 676
export const PREVIEW_PADDING = 24
export const PREVIEW_TOP_PADDING = 40
export const PREVIEW_BOTTOM_PADDING = 64
export const ARTICLE_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"

/** token 到 CSS 变量；text-list-gap 是内部变量，不向 theme.css 开放 */
export function tokenVariables(token: ThemeToken): Record<string, string> {
  const values: Record<string, string> = {
    primary: token.primary,
    'background-color': token.backgroundColor,
    'table-header-background-color': token.table.headerBackgroundColor,
    'border-color': token.borderColor,
    'border-radius': `${token.borderRadius}px`,
    'text-font-size': `${token.text.fontSize}px`,
    'text-secondary-font-size': `${token.text.secondaryFontSize}px`,
    'text-line-height': String(token.text.lineHeight),
    'text-letter-spacing': `${token.text.letterSpacing}em`,
    'text-margin-bottom': `${token.text.marginBottom}px`,
    'text-list-gap': `${Math.max(4, Math.round(token.text.marginBottom / 2))}px`,
    'text-color': token.text.color,
    'text-secondary-color': token.text.secondaryColor,
    'quote-padding': `${token.quote.padding}px`,
    'code-line-height': String(token.code.lineHeight),
    'code-padding': `${token.code.padding}px`,
    'code-background-color':
      token.code.backgroundColor ?? highlightThemeBackground(token.code.hljsTheme),
    'table-padding': `${token.table.padding}px`,
    'image-margin-top': `${token.image.marginTop}px`,
    'image-margin-bottom': `${token.image.marginBottom}px`,
    'divider-border-top-style': token.divider.borderTopStyle,
    'divider-border-top-color': token.divider.borderTopColor,
  }

  for (const key of HEADING_KEYS) {
    values[`${key}-font-size`] = `${token[key].fontSize}px`
    values[`${key}-color`] = headingColor(token, key)
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
    const border = `var(--fucha-primary)`
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
    `  max-width: ${PREVIEW_CONTENT_WIDTH + PREVIEW_PADDING * 2}px;`,
    '  margin: 0 auto;',
    `  padding: ${PREVIEW_TOP_PADDING}px ${PREVIEW_PADDING}px ${PREVIEW_BOTTOM_PADDING}px;`,
    `  font-family: ${ARTICLE_FONT_FAMILY};`,
    '  font-size: var(--fucha-text-font-size);',
    '  line-height: var(--fucha-text-line-height);',
    '  letter-spacing: var(--fucha-text-letter-spacing);',
    '  color: var(--fucha-text-color);',
    '  word-break: break-word;',
    '  text-align: left;',
  ].join('\n')
}

/** 预览：token 变量 + base.css + 装饰 + 语法色 + theme.css，全部限定在 .article-body */
export function buildPreviewCss(theme: ThemeDefinition): string {
  const token = theme.token
  const variables = Object.entries(tokenVariables(token))
    .map(([name, value]) => `  --fucha-${name}: ${value};`)
    .join('\n')
  const themeCss = [decorationCss(token), highlightThemeCss(token.code.hljsTheme), theme.css]
    .filter(Boolean)
    .join('\n\n')

  return [
    `.article-body {\n${variables}\n${previewCanvas()}\n}`,
    scopeCss(BASE_CSS, '.article-body'),
    themeCss ? scopeCss(themeCss, '.article-body') : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** 导出：同一份 CSS 去掉作用域并把变量解析成具体值，juice 不解析 var() */
export function buildExportCss(theme: ThemeDefinition): string {
  const token = theme.token
  const css = [BASE_CSS, decorationCss(token), highlightThemeCss(token.code.hljsTheme), theme.css]
    .filter(Boolean)
    .join('\n\n')
  return resolveThemeVariables(css, tokenVariables(token))
}

/** 导出外层 section 的基础样式；与预览 .article-body 的字体基线同源 */
export function exportRootStyle(token: ThemeToken): string {
  const values = tokenVariables(token)
  return [
    `font-family: ${ARTICLE_FONT_FAMILY}`,
    `font-size: ${values['text-font-size']}`,
    `line-height: ${values['text-line-height']}`,
    `letter-spacing: ${values['text-letter-spacing']}`,
    `color: ${values['text-color']}`,
    'word-break: break-word',
    'text-align: left',
  ].join('; ')
}
