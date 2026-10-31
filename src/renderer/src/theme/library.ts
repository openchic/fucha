import type { ThemeRecord } from '@shared/store-types'
import type { ThemeToken } from '@shared/types'
import { BUILTIN_THEMES } from './presets'

export type AvailableTheme = {
  id: string
  name: string
  token: ThemeToken
  css: string
  builtin: boolean
  sourceThemeId?: string
}

export const BUILTIN_AVAILABLE: AvailableTheme[] = BUILTIN_THEMES.map(({ token, css }) => ({
  id: token.id,
  name: token.name,
  token,
  css,
  builtin: true,
}))

export const DEFAULT_AVAILABLE_THEME: AvailableTheme = BUILTIN_AVAILABLE[0]!

export function recordToTheme(record: ThemeRecord): AvailableTheme {
  return {
    id: record.id,
    name: record.name,
    token: record.token,
    css: record.css,
    builtin: false,
    sourceThemeId: record.sourceThemeId,
  }
}

export function findTheme(themes: AvailableTheme[], id: string | null): AvailableTheme | undefined {
  if (!id) return undefined
  return themes.find((theme) => theme.id === id)
}

/** 去掉 Electron IPC 包装，留下可直接展示的错误文案 */
export function themeErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error)
  const cleaned = message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
  return cleaned.trim() || fallback
}
