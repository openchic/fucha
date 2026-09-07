import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '@renderer/theme/presets'
import { previewStyleVariables, tokenVariables } from '@renderer/theme/apply'

describe('previewStyleVariables', () => {
  it('所有变量带 --theme- 前缀', () => {
    const variables = previewStyleVariables(DEFAULT_THEME.token)
    expect(Object.keys(variables).length).toBeGreaterThan(0)
    expect(Object.keys(variables).every((name) => name.startsWith('--theme-'))).toBe(true)
  })

  it('与 tokenVariables 的键一一对应', () => {
    const base = tokenVariables(DEFAULT_THEME.token)
    const preview = previewStyleVariables(DEFAULT_THEME.token)
    expect(Object.keys(preview).sort()).toEqual(
      Object.keys(base)
        .map((name) => `--theme-${name}`)
        .sort()
    )
  })

  it('引用背景取自 quote 字段', () => {
    const variables = previewStyleVariables(DEFAULT_THEME.token)
    expect(variables['--theme-quote-background-color']).toBe(
      DEFAULT_THEME.token.quote.backgroundColor
    )
  })

  it('字号带 px，行高与字距不带单位', () => {
    const variables = previewStyleVariables(DEFAULT_THEME.token)
    expect(variables['--theme-text-font-size']).toBe(`${DEFAULT_THEME.token.text.fontSize}px`)
    expect(variables['--theme-text-line-height']).toBe(String(DEFAULT_THEME.token.text.lineHeight))
    expect(variables['--theme-text-letter-spacing']).toBe(
      `${DEFAULT_THEME.token.text.letterSpacing}em`
    )
  })

  it('未设置页面背景时输出 transparent', () => {
    const token = { ...DEFAULT_THEME.token, page: { ...DEFAULT_THEME.token.page } }
    delete token.page.backgroundColor
    expect(previewStyleVariables(token)['--theme-page-background-color']).toBe('transparent')
  })
})
