import type { AppApi, ThemeToken } from '@shared/types'
import type { ThemeRecord } from '@shared/store-types'
import { vi } from 'vitest'

export function stubThemeRecord(token: ThemeToken, css = ''): ThemeRecord {
  return {
    id: token.id,
    name: token.name,
    token,
    css,
    tokenVersion: 1,
    sort: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

/** 完整的 preload API 假实现；未覆盖的方法给出稳定的空结果 */
export function createFakeApi(overrides: Partial<AppApi> = {}): AppApi {
  const api: AppApi = {
    fetchArticle: vi.fn(async (url: string) => ({
      ok: true as const,
      html: '<p>fixture</p>',
      finalUrl: url,
    })),
    downloadImages: vi.fn(async () => []),
    exportHtml: vi.fn(async () => ''),
    copyHtml: vi.fn(async () => {}),
    listThemes: vi.fn(async () => []),
    createTheme: vi.fn(async (input) => stubThemeRecord(input.token, input.css)),
    updateTheme: vi.fn(async (input) => stubThemeRecord(input.token, input.css)),
    deleteTheme: vi.fn(async () => {}),
    exportThemePackage: vi.fn(async () => ({
      ok: true as const,
      path: '/tmp/theme.article-theme',
    })),
    importThemePackage: vi.fn(async () => ({ ok: false as const, canceled: true })),
    getPreference: vi.fn(async () => null),
    setPreference: vi.fn(async () => {}),
    listArticles: vi.fn(async () => []),
    getArticle: vi.fn(async () => null),
    saveArticle: vi.fn(async (input) => ({
      hash: input.hash,
      sourceUrl: input.article.sourceUrl,
      finalUrl: input.finalUrl,
      title: input.article.title,
      author: input.article.author,
      publishedAt: input.article.publishedAt,
      cover: input.article.cover,
      html: input.article.html,
      themeId: input.themeId ?? 'default',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      visitCount: 0,
      images: input.images.map((image, sort) => ({ ...image, sort })),
    })),
    replaceArticleImages: vi.fn(async () => {}),
    setArticleTheme: vi.fn(async () => true),
    touchArticle: vi.fn(async () => true),
    deleteArticle: vi.fn(async () => true),
  }

  const merged = { ...api } as AppApi
  for (const [key, implementation] of Object.entries(overrides)) {
    if (implementation) {
      ;(merged as Record<string, unknown>)[key] = vi.fn(
        implementation as (...args: never[]) => unknown
      )
    }
  }
  return merged
}

/** 把假实现安装到 window.api，返回卸载函数 */
export function installFakeApi(overrides: Partial<AppApi> = {}): AppApi {
  const api = createFakeApi(overrides)
  Object.defineProperty(window, 'api', { value: api, configurable: true, writable: true })
  return api
}
