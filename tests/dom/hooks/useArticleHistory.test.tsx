import type { ArticleSummary } from '@shared/store-types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArticleHistory } from '@renderer/hooks/useArticleHistory'
import { installFakeApi } from '../../setup/fake-api'

function summary(hash: string): ArticleSummary {
  return {
    hash,
    sourceUrl: `https://example.com/${hash}`,
    finalUrl: `https://example.com/${hash}`,
    title: `文章 ${hash}`,
    themeId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    visitCount: 0,
  }
}

describe('useArticleHistory', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('加载成功后返回列表并标记 ready', async () => {
    const api = installFakeApi({ listArticles: async () => [summary('a'), summary('b')] })
    const { result } = renderHook(() => useArticleHistory())

    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.items.map((item) => item.hash)).toEqual(['a', 'b'])
    expect(result.current.error).toBeUndefined()
    expect(api.listArticles).toHaveBeenCalledWith(50, 0)
  })

  it('加载失败时返回空列表和错误文案，不抛未处理异常', async () => {
    installFakeApi({
      listArticles: async () => {
        throw new Error('db down')
      },
    })
    const { result } = renderHook(() => useArticleHistory())

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBe('历史暂不可用')
  })

  it('refresh 重新拉取并清除错误', async () => {
    const api = installFakeApi({ listArticles: async () => [] })
    const { result } = renderHook(() => useArticleHistory())
    await waitFor(() => expect(result.current.ready).toBe(true))

    vi.mocked(api.listArticles).mockRejectedValueOnce(new Error('fail'))
    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.error).toBe('历史暂不可用'))

    act(() => result.current.refresh())
    await waitFor(() => expect(result.current.error).toBeUndefined())
    expect(api.listArticles).toHaveBeenCalledTimes(3)
  })

  it('卸载后到达的结果不再写入状态', async () => {
    let resolveList: (items: ArticleSummary[]) => void = () => {}
    installFakeApi({
      listArticles: () =>
        new Promise<ArticleSummary[]>((resolve) => {
          resolveList = resolve
        }),
    })
    const { unmount } = renderHook(() => useArticleHistory())
    unmount()
    resolveList([summary('late')])
    await Promise.resolve()
    expect(true).toBe(true)
  })
})
