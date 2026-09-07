import type { AppApi } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { createFakeApi } from '../setup/fake-api'

/** preload 暴露的全部方法；新增或删除 API 时这里必须同步 */
const API_METHODS: readonly (keyof AppApi)[] = [
  'fetchArticle',
  'downloadImages',
  'exportHtml',
  'copyHtml',
  'listThemes',
  'createTheme',
  'updateTheme',
  'deleteTheme',
  'exportThemePackage',
  'importThemePackage',
  'getPreference',
  'setPreference',
  'listArticles',
  'getArticle',
  'saveArticle',
  'replaceArticleImages',
  'setArticleTheme',
  'touchArticle',
  'deleteArticle',
]

describe('preload API 契约', () => {
  it('假实现覆盖全部方法且没有多余方法', () => {
    const api = createFakeApi()
    expect(Object.keys(api).sort()).toEqual([...API_METHODS].sort())
  })

  it('每个方法都是函数', () => {
    const api = createFakeApi()
    for (const method of API_METHODS) {
      expect(typeof api[method]).toBe('function')
    }
  })

  it('overrides 只替换指定方法', () => {
    const api = createFakeApi({ deleteArticle: async () => false })
    expect(api.deleteArticle).not.toBe(createFakeApi().deleteArticle)
    expect(typeof api.touchArticle).toBe('function')
  })
})
