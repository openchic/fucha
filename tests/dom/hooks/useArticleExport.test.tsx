import type { Article } from '@shared/types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useArticleExport } from '@renderer/hooks/useArticleExport'
import { BUILTIN_THEMES } from '@renderer/theme/presets'
import { installFakeApi } from '../../setup/fake-api'

const theme = BUILTIN_THEMES[0]!

function article(overrides: Partial<Article> = {}): Article {
  return {
    title: '标题',
    sourceUrl: 'https://example.com/a',
    html: '<p>正文</p>',
    images: [],
    ...overrides,
  }
}

const hash = 'a'.repeat(32)

describe('useArticleExport', () => {
  it('复制成功后回显提示并调用导出与剪贴板', async () => {
    const api = installFakeApi({ exportHtml: async () => '<div>导出</div>' })
    const { result } = renderHook(() => useArticleExport(article(), hash, theme))

    act(() => result.current.copy())
    expect(result.current.state.action).toBe('copy')

    await waitFor(() => expect(result.current.state.notice).toBe('已复制到剪贴板'))
    expect(result.current.state.action).toBeNull()
    expect(api.exportHtml).toHaveBeenCalledWith({
      articleHash: hash,
      html: expect.stringContaining('正文'),
    })
    expect(api.copyHtml).toHaveBeenCalledWith({
      html: '<div>导出</div>',
      text: expect.any(String),
    })
  })

  it('导出失败时只回显错误，不抛未处理异常', async () => {
    installFakeApi({
      exportHtml: async () => {
        throw new Error('boom')
      },
    })
    const { result } = renderHook(() => useArticleExport(article(), hash, theme))

    act(() => result.current.copy())
    await waitFor(() => expect(result.current.state.error).toBe('导出失败，请重试'))
    expect(result.current.state.action).toBeNull()
  })

  it('没有文章时不执行导出', async () => {
    const api = installFakeApi()
    const { result } = renderHook(() => useArticleExport(null, '', theme))

    act(() => result.current.copy())
    await Promise.resolve()
    expect(api.exportHtml).not.toHaveBeenCalled()
    expect(api.copyHtml).not.toHaveBeenCalled()
    expect(result.current.state).toEqual({ action: null })
  })

  it('换文章后清空上一次的提示', async () => {
    installFakeApi({ exportHtml: async () => '<div>导出</div>' })
    const { result, rerender } = renderHook(
      (props: { article: Article }) => useArticleExport(props.article, hash, theme),
      { initialProps: { article: article() } }
    )

    act(() => result.current.copy())
    await waitFor(() => expect(result.current.state.notice).toBe('已复制到剪贴板'))

    rerender({ article: article({ sourceUrl: 'https://example.com/b' }) })
    await waitFor(() => expect(result.current.state.notice).toBeUndefined())
  })
})
