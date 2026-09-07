import type { HeadingToken } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { BUILTIN_THEME_IDS, BUILTIN_THEME_NAMES } from '@shared/builtin-themes'
import { validateThemeToken, type HeadingKey } from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import { BUILTIN_THEMES, DEFAULT_THEME } from '@renderer/theme/presets'

function heading(themeIndex: number, key: HeadingKey): HeadingToken {
  return BUILTIN_THEMES[themeIndex]!.token[key]
}

describe('内置主题集合', () => {
  it('保持 default、shujuan、qingci 三套且顺序稳定', () => {
    expect(BUILTIN_THEMES.map((theme) => theme.token.id)).toEqual(['default', 'shujuan', 'qingci'])
  })

  it('DEFAULT_THEME 是第一套主题', () => {
    expect(DEFAULT_THEME).toBe(BUILTIN_THEMES[0])
  })

  it('id 与名称符合主进程契约', () => {
    expect(BUILTIN_THEMES.map((theme) => theme.token.id)).toEqual([...BUILTIN_THEME_IDS])
    for (const theme of BUILTIN_THEMES) {
      expect(BUILTIN_THEME_NAMES[theme.token.id]).toBe(theme.token.name)
    }
  })

  it('全部标记为内置主题', () => {
    for (const theme of BUILTIN_THEMES) {
      expect(theme.token.builtin).toBe(true)
    }
  })

  it.each(BUILTIN_THEMES)('$token.id 的 token 能通过校验', ({ token }) => {
    expect(validateThemeToken(token)).toEqual(token)
  })

  it.each(BUILTIN_THEMES)('$token.id 的 css 能通过校验', ({ css }) => {
    expect(validateThemeCss(css)).toBe(css)
  })
})

describe('内置主题的两层标题', () => {
  for (const [index, theme] of BUILTIN_THEMES.entries()) {
    const id = theme.token.id

    it(`${id}：H1 与 H2 完全一致`, () => {
      expect(heading(index, 'h1')).toEqual(heading(index, 'h2'))
    })

    it(`${id}：H3 至 H6 完全一致`, () => {
      expect(heading(index, 'h3')).toEqual(heading(index, 'h4'))
      expect(heading(index, 'h4')).toEqual(heading(index, 'h5'))
      expect(heading(index, 'h5')).toEqual(heading(index, 'h6'))
    })

    it(`${id}：两层标题必须可区分`, () => {
      expect(heading(index, 'h1')).not.toEqual(heading(index, 'h3'))
    })

    it(`${id}：正文小于标题`, () => {
      expect(theme.token.text.fontSize).toBeLessThan(heading(index, 'h3').fontSize)
    })
  }
})

describe('内置主题的页面与代码块', () => {
  it.each(BUILTIN_THEMES)('$token.id 的左右页面内距默认为 0', ({ token }) => {
    expect(token.page.paddingLeft).toBe(0)
    expect(token.page.paddingRight).toBe(0)
  })

  it.each(BUILTIN_THEMES)('$token.id 显式写入代码块背景色', ({ token }) => {
    expect(token.code.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('书卷使用衬线字族根规则', () => {
    const shujuan = BUILTIN_THEMES.find((theme) => theme.token.id === 'shujuan')
    expect(shujuan?.css).toContain('font-family')
    expect(shujuan?.css).toContain('serif')
    expect(shujuan?.css).toContain('&')
  })
})
