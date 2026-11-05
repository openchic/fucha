import type { ThemeDefinition } from '@shared/types'
import { BUILTIN_THEME_IDS, BUILTIN_THEME_NAMES, validateThemeToken } from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import defaultTheme from './default.json'
import serifTheme from './serif.json'
import danxiaTheme from './danxia.json'
import { SERIF_THEME_CSS } from './serif-css'

function defineBuiltinTheme(token: unknown, css = ''): ThemeDefinition {
  return { token: validateThemeToken(token), css: validateThemeCss(css) }
}

/** 内置主题按 id 稳定排序；升级视觉时新增 id，不改旧 id 的 token/css */
export const BUILTIN_THEMES: ThemeDefinition[] = [
  defineBuiltinTheme(defaultTheme),
  defineBuiltinTheme(serifTheme, SERIF_THEME_CSS),
  defineBuiltinTheme(danxiaTheme),
]

/** 主进程用同一份 id/名称表保护唯一性，注册漏项会让保护失效 */
function assertBuiltinRegistry(): void {
  const registeredIds: readonly string[] = BUILTIN_THEME_IDS
  const names: Record<string, string> = BUILTIN_THEME_NAMES
  const ids = BUILTIN_THEMES.map(({ token }) => token.id)

  if (new Set(ids).size !== ids.length) throw new Error('内置主题 id 重复')

  const missing = registeredIds.filter((id) => !ids.includes(id))
  const extra = ids.filter((id) => !registeredIds.includes(id))
  if (missing.length || extra.length) {
    throw new Error(
      `内置主题注册不完整：缺少 ${missing.join('、') || '无'}；未登记 ${extra.join('、') || '无'}`
    )
  }

  const renamed = BUILTIN_THEMES.filter(({ token }) => names[token.id] !== token.name)
  if (renamed.length) {
    throw new Error(
      `内置主题名称不一致：${renamed
        .map(({ token }) => `${token.id}（当前 ${token.name}，应为 ${names[token.id]}）`)
        .join('；')}`
    )
  }
}

assertBuiltinRegistry()

export const DEFAULT_THEME: ThemeDefinition = BUILTIN_THEMES[0]!

export function findBuiltinTheme(id: string): ThemeDefinition | undefined {
  return BUILTIN_THEMES.find((theme) => theme.token.id === id)
}
