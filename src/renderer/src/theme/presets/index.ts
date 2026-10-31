import type { ThemeDefinition } from '@shared/types'
import { validateThemeToken } from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import defaultTheme from './default.json'
import serifTheme from './serif.json'
import { DEFAULT_THEME_CSS } from './default-css'
import { SERIF_THEME_CSS } from './serif-css'

/** 内置主题按 id 稳定排序；升级视觉时新增 id，不改旧 id 的 token/css */
export const BUILTIN_THEMES: ThemeDefinition[] = [
  { token: validateThemeToken(defaultTheme), css: validateThemeCss(DEFAULT_THEME_CSS) },
  { token: validateThemeToken(serifTheme), css: validateThemeCss(SERIF_THEME_CSS) },
]

export const DEFAULT_THEME: ThemeDefinition = BUILTIN_THEMES[0]!

export function findBuiltinTheme(id: string): ThemeDefinition | undefined {
  return BUILTIN_THEMES.find((theme) => theme.token.id === id)
}
