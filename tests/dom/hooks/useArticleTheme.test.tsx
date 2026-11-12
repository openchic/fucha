import type { StoredArticle } from '@shared/store-types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useArticleTheme } from '@renderer/hooks/useArticleTheme'
import { BUILTIN_AVAILABLE } from '@renderer/theme/library'
import { installFakeApi } from '../../setup/fake-api'

function storedArticle(hash: string, themeId?: string): StoredArticle {
  return {
    hash,
    sourceUrl: `https://example.com/${hash}`,
    finalUrl: `https://example.com/${hash}`,
    title: '文章',
    html: '<p>正文</p>',
    themeId: themeId ?? '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    visitCount: 0,
    images: [],
  }
}

const themes = BUILTIN_AVAILABLE

describe('useArticleTheme', () => {
  it('没有文章时使用默认主题且未 ready', async () => {
    installFakeApi()
    const { result } = renderHook(() => useArticleTheme({ articleHash: null, themes, ready: true }))
    expect(result.current.activeTheme.id).toBe('default')
    expect(result.current.themeReady).toBe(false)
  })

  it('存储未就绪时不读取文章主题', async () => {
    const api = installFakeApi()
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: false })
    )
    await Promise.resolve()
    expect(api.getArticle).not.toHaveBeenCalled()
    expect(result.current.themeReady).toBe(false)
  })

  it('优先使用文章记录的主题', async () => {
    const api = installFakeApi({
      getArticle: async (hash: string) => storedArticle(hash, 'shujuan'),
    })
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: true })
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))
    expect(result.current.activeTheme.id).toBe('shujuan')
    expect(api.getPreference).not.toHaveBeenCalled()
  })

  it('文章没有主题时回退到偏好', async () => {
    const api = installFakeApi({
      getArticle: async (hash: string) => storedArticle(hash),
      getPreference: async () => 'qingci',
    })
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: true })
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))
    expect(result.current.activeTheme.id).toBe('qingci')
    expect(api.getPreference).toHaveBeenCalledWith('theme.active')
  })

  it('未知主题 id 回退默认主题', async () => {
    installFakeApi({
      getArticle: async (hash: string) => storedArticle(hash, 'gone'),
      getPreference: async () => 'missing',
    })
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: true })
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))
    expect(result.current.activeTheme.id).toBe('default')
  })

  it('存储异常时回退默认主题且不阻断 ready', async () => {
    installFakeApi({
      getArticle: async () => {
        throw new Error('db down')
      },
      getPreference: async () => {
        throw new Error('db down')
      },
    })
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: true })
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))
    expect(result.current.activeTheme.id).toBe('default')
  })

  it('selectTheme 切换主题并同步文章记录与偏好', async () => {
    const api = installFakeApi({ getArticle: async (hash: string) => storedArticle(hash) })
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: true })
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))

    act(() => result.current.selectTheme('shujuan'))
    expect(result.current.activeTheme.id).toBe('shujuan')
    expect(api.setArticleTheme).toHaveBeenCalledWith('a'.repeat(32), 'shujuan')
    expect(api.setPreference).toHaveBeenCalledWith('theme.active', 'shujuan')
  })

  it('selectTheme 忽略未知主题', async () => {
    const api = installFakeApi({ getArticle: async (hash: string) => storedArticle(hash) })
    const { result } = renderHook(() =>
      useArticleTheme({ articleHash: 'a'.repeat(32), themes, ready: true })
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))

    act(() => result.current.selectTheme('nope'))
    expect(result.current.activeTheme.id).toBe('default')
    expect(api.setArticleTheme).not.toHaveBeenCalled()
    expect(api.setPreference).not.toHaveBeenCalled()
  })

  it('没有文章时只写入偏好', async () => {
    const api = installFakeApi()
    const { result } = renderHook(() => useArticleTheme({ articleHash: null, themes, ready: true }))
    act(() => result.current.selectTheme('qingci'))
    expect(result.current.activeTheme.id).toBe('qingci')
    expect(api.setArticleTheme).not.toHaveBeenCalled()
    expect(api.setPreference).toHaveBeenCalledWith('theme.active', 'qingci')
  })

  it('同一文章 hash 不重复读取主题', async () => {
    const api = installFakeApi({ getArticle: async (hash: string) => storedArticle(hash) })
    const { result, rerender } = renderHook(
      (props: { hash: string }) =>
        useArticleTheme({ articleHash: props.hash, themes, ready: true }),
      { initialProps: { hash: 'a'.repeat(32) } }
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))
    rerender({ hash: 'a'.repeat(32) })
    await Promise.resolve()
    expect(api.getArticle).toHaveBeenCalledTimes(1)
  })

  it('切换到另一篇文章时重新读取主题', async () => {
    const api = installFakeApi({ getArticle: async (hash: string) => storedArticle(hash) })
    const { result, rerender } = renderHook(
      (props: { hash: string }) =>
        useArticleTheme({ articleHash: props.hash, themes, ready: true }),
      { initialProps: { hash: 'a'.repeat(32) } }
    )
    await waitFor(() => expect(result.current.themeReady).toBe(true))

    rerender({ hash: 'b'.repeat(32) })
    await waitFor(() => expect(api.getArticle).toHaveBeenCalledWith('b'.repeat(32)))
  })
})
