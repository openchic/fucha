import type { HeadingDecoration, HeadingToken, ThemeToken } from './types'

export const THEME_TOKEN_VERSION = 1

/** 内置主题 id；主进程据此拒绝同 id 的自定义主题，避免解析歧义 */
export const BUILTIN_THEME_IDS = ['default', 'serif', 'danxia'] as const

/** 代码语法主题白名单；值必须与 renderer theme/highlight.ts 的 THEME_CSS 对齐 */
export const HLJS_THEME_VALUES = ['github', 'atom-one-light', 'xcode'] as const
export const CODE_BORDER_STYLE_VALUES = ['solid', 'dashed', 'none'] as const

/** 内置主题名称；主进程据此拒绝重名的自定义主题 */
export const BUILTIN_THEME_NAMES: Record<(typeof BUILTIN_THEME_IDS)[number], string> = {
  default: '清简',
  serif: '书卷',
  danxia: '丹霞',
}

export type NumericRange = {
  min: number
  max: number
  step: number
  integer?: boolean
}

/** 滑杆与校验共用的数值边界 */
export const THEME_RANGES = {
  fontSize: { min: 12, max: 20, step: 1, integer: true },
  secondaryFontSize: { min: 12, max: 20, step: 1, integer: true },
  lineHeight: { min: 1, max: 3, step: 0.05 },
  headingFontWeight: { min: 100, max: 700, step: 100, integer: true },
  letterSpacing: { min: 0, max: 0.3, step: 0.01 },
  marginBottom: { min: 0, max: 40, step: 1, integer: true },
  h1FontSize: { min: 12, max: 40, step: 1, integer: true },
  h2FontSize: { min: 12, max: 40, step: 1, integer: true },
  h3FontSize: { min: 12, max: 40, step: 1, integer: true },
  h4FontSize: { min: 12, max: 40, step: 1, integer: true },
  h5FontSize: { min: 12, max: 40, step: 1, integer: true },
  h6FontSize: { min: 12, max: 40, step: 1, integer: true },
  headingMarginTop: { min: 0, max: 40, step: 1, integer: true },
  headingMarginBottom: { min: 0, max: 40, step: 1, integer: true },
  dividerMarginTop: { min: 0, max: 40, step: 1, integer: true },
  dividerMarginBottom: { min: 0, max: 40, step: 1, integer: true },
  quotePadding: { min: 0, max: 40, step: 1, integer: true },
  codeLineHeight: { min: 1, max: 3, step: 0.05 },
  codePadding: { min: 0, max: 40, step: 1, integer: true },
  tablePadding: { min: 0, max: 40, step: 1, integer: true },
  imageMarginTop: { min: 0, max: 40, step: 1, integer: true },
  imageMarginBottom: { min: 0, max: 40, step: 1, integer: true },
  pagePadding: { min: 0, max: 80, step: 1, integer: true },
  borderRadius: { min: 0, max: 20, step: 1, integer: true },
} satisfies Record<string, NumericRange>

export const HEADING_KEYS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

export type HeadingKey = (typeof HEADING_KEYS)[number]

const HEADING_ALIGN = ['left', 'center'] as const
const HEADING_DECORATION = ['none', 'bar', 'underline', 'bracket'] as const
const DIVIDER_BORDER_TOP_STYLE = ['solid', 'dashed', 'none'] as const

function fail(path: string, reason: string): never {
  throw new Error(`${path} ${reason}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(path, '必须是非空字符串')
  return value.trim()
}

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, '必须是布尔值')
  return value
}

function requiredColor(value: unknown, path: string): string {
  const color = requiredString(value, path)
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    fail(path, '必须是 #rrggbb 或 #rgb 颜色')
  }
  return color
}

function optionalColor(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  return requiredColor(value, path)
}

function requiredNumber(value: unknown, path: string, range: NumericRange): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, '必须是数字')
  if (value < range.min || value > range.max) {
    fail(path, `必须在 ${range.min} 到 ${range.max} 之间`)
  }
  if (range.integer && !Number.isInteger(value)) fail(path, '必须是整数')
  return value
}

function requiredEnum<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(path, `必须是 ${allowed.join(' / ')} 之一`)
  }
  return value as T
}

function readGroup(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) fail(path, '必须是对象')
  return value
}

function readHeading(value: unknown, path: string, fontSizeRange: NumericRange): HeadingToken {
  const heading = readGroup(value, path)
  return {
    fontSize: requiredNumber(heading.fontSize, `${path}.fontSize`, fontSizeRange),
    fontWeight: requiredNumber(
      heading.fontWeight,
      `${path}.fontWeight`,
      THEME_RANGES.headingFontWeight
    ),
    lineHeight: requiredNumber(heading.lineHeight, `${path}.lineHeight`, THEME_RANGES.lineHeight),
    textAlign: requiredEnum(heading.textAlign, `${path}.textAlign`, HEADING_ALIGN),
    decoration: requiredEnum<HeadingDecoration>(
      heading.decoration,
      `${path}.decoration`,
      HEADING_DECORATION
    ),
    marginTop: requiredNumber(
      heading.marginTop,
      `${path}.marginTop`,
      THEME_RANGES.headingMarginTop
    ),
    marginBottom: requiredNumber(
      heading.marginBottom,
      `${path}.marginBottom`,
      THEME_RANGES.headingMarginBottom
    ),
  }
}

/** 校验主题 token；不合法时抛出带字段路径的可读错误 */
export function validateThemeToken(input: unknown): ThemeToken {
  const root = readGroup(input, 'theme')
  const text = readGroup(root.text, 'theme.text')
  const quote = readGroup(root.quote, 'theme.quote')
  const code = readGroup(root.code, 'theme.code')
  const table = readGroup(root.table, 'theme.table')
  const image = readGroup(root.image, 'theme.image')
  const divider = readGroup(root.divider, 'theme.divider')
  const page = readGroup(root.page, 'theme.page')

  return {
    id: requiredString(root.id, 'theme.id'),
    name: requiredString(root.name, 'theme.name'),
    builtin: requiredBoolean(root.builtin, 'theme.builtin'),
    text: {
      fontSize: requiredNumber(text.fontSize, 'theme.text.fontSize', THEME_RANGES.fontSize),
      secondaryFontSize: requiredNumber(
        text.secondaryFontSize,
        'theme.text.secondaryFontSize',
        THEME_RANGES.secondaryFontSize
      ),
      lineHeight: requiredNumber(text.lineHeight, 'theme.text.lineHeight', THEME_RANGES.lineHeight),
      letterSpacing: requiredNumber(
        text.letterSpacing,
        'theme.text.letterSpacing',
        THEME_RANGES.letterSpacing
      ),
      marginBottom: requiredNumber(
        text.marginBottom,
        'theme.text.marginBottom',
        THEME_RANGES.marginBottom
      ),
      color: requiredColor(text.color, 'theme.text.color'),
      secondaryColor: requiredColor(text.secondaryColor, 'theme.text.secondaryColor'),
    },
    primary: requiredColor(root.primary, 'theme.primary'),
    borderColor: requiredColor(root.borderColor, 'theme.borderColor'),
    headingColor: requiredColor(root.headingColor, 'theme.headingColor'),
    page: {
      paddingTop: requiredNumber(
        page.paddingTop,
        'theme.page.paddingTop',
        THEME_RANGES.pagePadding
      ),
      paddingRight: requiredNumber(
        page.paddingRight,
        'theme.page.paddingRight',
        THEME_RANGES.pagePadding
      ),
      paddingBottom: requiredNumber(
        page.paddingBottom,
        'theme.page.paddingBottom',
        THEME_RANGES.pagePadding
      ),
      paddingLeft: requiredNumber(
        page.paddingLeft,
        'theme.page.paddingLeft',
        THEME_RANGES.pagePadding
      ),
    },
    h1: readHeading(root.h1, 'theme.h1', THEME_RANGES.h1FontSize),
    h2: readHeading(root.h2, 'theme.h2', THEME_RANGES.h2FontSize),
    h3: readHeading(root.h3, 'theme.h3', THEME_RANGES.h3FontSize),
    h4: readHeading(root.h4, 'theme.h4', THEME_RANGES.h4FontSize),
    h5: readHeading(root.h5, 'theme.h5', THEME_RANGES.h5FontSize),
    h6: readHeading(root.h6, 'theme.h6', THEME_RANGES.h6FontSize),
    quote: {
      backgroundColor: requiredColor(quote.backgroundColor, 'theme.quote.backgroundColor'),
      paddingBlock: requiredNumber(
        quote.paddingBlock,
        'theme.quote.paddingBlock',
        THEME_RANGES.quotePadding
      ),
      paddingInline: requiredNumber(
        quote.paddingInline,
        'theme.quote.paddingInline',
        THEME_RANGES.quotePadding
      ),
      borderRadius: requiredNumber(
        quote.borderRadius,
        'theme.quote.borderRadius',
        THEME_RANGES.borderRadius
      ),
    },
    code: {
      hljsTheme: requiredEnum(code.hljsTheme, 'theme.code.hljsTheme', HLJS_THEME_VALUES),
      backgroundColor: optionalColor(code.backgroundColor, 'theme.code.backgroundColor'),
      inlineBackgroundColor: requiredColor(
        code.inlineBackgroundColor,
        'theme.code.inlineBackgroundColor'
      ),
      lineHeight: requiredNumber(
        code.lineHeight,
        'theme.code.lineHeight',
        THEME_RANGES.codeLineHeight
      ),
      paddingBlock: requiredNumber(
        code.paddingBlock,
        'theme.code.paddingBlock',
        THEME_RANGES.codePadding
      ),
      paddingInline: requiredNumber(
        code.paddingInline,
        'theme.code.paddingInline',
        THEME_RANGES.codePadding
      ),
      borderRadius: requiredNumber(
        code.borderRadius,
        'theme.code.borderRadius',
        THEME_RANGES.borderRadius
      ),
      inlineBorderRadius: requiredNumber(
        code.inlineBorderRadius,
        'theme.code.inlineBorderRadius',
        THEME_RANGES.borderRadius
      ),
      borderStyle: requiredEnum(
        code.borderStyle,
        'theme.code.borderStyle',
        CODE_BORDER_STYLE_VALUES
      ),
    },
    table: {
      headerBackgroundColor: requiredColor(
        table.headerBackgroundColor,
        'theme.table.headerBackgroundColor'
      ),
      paddingBlock: requiredNumber(
        table.paddingBlock,
        'theme.table.paddingBlock',
        THEME_RANGES.tablePadding
      ),
      paddingInline: requiredNumber(
        table.paddingInline,
        'theme.table.paddingInline',
        THEME_RANGES.tablePadding
      ),
    },
    image: {
      marginTop: requiredNumber(
        image.marginTop,
        'theme.image.marginTop',
        THEME_RANGES.imageMarginTop
      ),
      marginBottom: requiredNumber(
        image.marginBottom,
        'theme.image.marginBottom',
        THEME_RANGES.imageMarginBottom
      ),
      borderRadius: requiredNumber(
        image.borderRadius,
        'theme.image.borderRadius',
        THEME_RANGES.borderRadius
      ),
    },
    divider: {
      borderTopStyle: requiredEnum(
        divider.borderTopStyle,
        'theme.divider.borderTopStyle',
        DIVIDER_BORDER_TOP_STYLE
      ),
      borderTopColor: requiredColor(divider.borderTopColor, 'theme.divider.borderTopColor'),
      marginTop: requiredNumber(
        divider.marginTop,
        'theme.divider.marginTop',
        THEME_RANGES.dividerMarginTop
      ),
      marginBottom: requiredNumber(
        divider.marginBottom,
        'theme.divider.marginBottom',
        THEME_RANGES.dividerMarginBottom
      ),
    },
  }
}
