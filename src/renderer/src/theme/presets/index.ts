import type { ThemeDefinition } from '@shared/types'
import { BUILTIN_THEME_TOKENS } from '@shared/theme-presets'
import { validateThemeToken } from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import { SHUJUAN_THEME_CSS } from './shujuan-css'

const BUILTIN_THEME_CSS: Record<string, string> = {
  shujuan: SHUJUAN_THEME_CSS,
}

function defineBuiltinTheme(token: unknown, css = ''): ThemeDefinition {
  return { token: validateThemeToken(token), css: validateThemeCss(css) }
}

/** 内置主题顺序取自 shared/theme-presets；升级视觉时新增 id，不改旧 id 的 token/css */
export const BUILTIN_THEMES: ThemeDefinition[] = BUILTIN_THEME_TOKENS.map((token) =>
  defineBuiltinTheme(token, BUILTIN_THEME_CSS[token.id] ?? '')
)

export const DEFAULT_THEME: ThemeDefinition = BUILTIN_THEMES[0]!

export function findBuiltinTheme(id: string): ThemeDefinition | undefined {
  return BUILTIN_THEMES.find((theme) => theme.token.id === id)
}
