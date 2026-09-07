import type { ThemeDefinition } from '@shared/types'
import { validateThemeToken } from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import { defaultPreset } from './default'
import { qingciPreset } from './qingci'
import { shujuanPreset } from './shujuan'

const PRESETS = [defaultPreset, shujuanPreset, qingciPreset]

/** 内置主题顺序即 PRESETS 顺序；升级视觉时新增 id，不改旧 id 的 token/css */
export const BUILTIN_THEMES: ThemeDefinition[] = PRESETS.map(({ token, css }) => ({
  token: validateThemeToken(token),
  css: validateThemeCss(css),
}))

export const DEFAULT_THEME: ThemeDefinition = BUILTIN_THEMES[0]!
