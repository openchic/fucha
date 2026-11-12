import type { FetchResult } from '@shared/types'
import type { StoredArticle } from '@shared/store-types'
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useArticlePreview } from '@renderer/hooks/useArticlePreview'
import { installFakeApi } from '../../setup/fake-api'

const HASH = 'b'.repeat(32)

function articleHtml(label: string): string {
  const body = `这是${label}的正文段落，用于让 Readability 判定为文章主体。`.repeat(20)
  return `<!doctype html><html><head><title>${label}</title></head><body><article><h1>${label}</h1><p>${body}</p></article></body></html>`
}

function storedArticle(): StoredArticle {
  return {
    hash: HASH,
    sourceUrl: 'https://example.com/saved',
    finalUrl: 'https://example.com/saved',
    title: '已保存文章',
    html: '<p>已保存正文</p>',
    themeId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    visitCount: 0,
    images: [
      { id: 'img-1', originalUrl: 'https://example.com/1.png', status: 'pending', sort: 0 },
      { id: 'img-2', originalUrl: 'https://example.com/2.png', status: 'pending', sort: 1 },
    ],
  }
}

describe('useArticlePreview：快照打开', () => {
  it('有快照时优先读取本地文章，不走网络', async () => {
    const api = installFakeApi({ getArticle: async () => storedArticle() })
    const { result } = renderHook(() =>
      useArticlePreview('https://example.com/url', { snapshotHash: HASH })
    )

    await waitFor(() => expect(result.current.state.view).toBe('preview'))
    const state = result.current.state
    if (state.view !== 'preview') throw new Error('expected preview')

    expect(state.fromSnapshot).toBe(true)
    expect(state.articleHash).toBe(HASH)
    expect(state.article.title).toBe('已保存文章')
    expect(state.previewHtml).toContain('已保存正文')
    expect(api.fetchArticle).not.toHaveBeenCalled()
  })

  it('按下载结果回填图片状态，缺结果的图片标记失败', async () => {
    installFakeApi({
      getArticle: async () => storedArticle(),
      downloadImages: async () => [{ id: 'img-1', status: 'done', file: '1.png' }],
    })
    const { result } = renderHook(() =>
      useArticlePreview('https://example.com/url', { snapshotHash: HASH })
    )

    await waitFor(() => expect(result.current.state.view).toBe('preview'))
    await waitFor(() => {
      if (result.current.state.view !== 'preview') throw new Error('expected preview')
      expect(result.current.state.article.images[0]?.status).toBe('done')
    })

    const state = result.current.state
    if (state.view !== 'preview') throw new Error('expected preview')
    expect(state.article.images[0]?.localPath).toBe('1.png')
    expect(state.article.images[1]?.status).toBe('failed')
  })

  it('快照不存在时回退到网络抓取', async () => {
    const api = installFakeApi({
      getArticle: async () => null,
      fetchArticle: async (url: string) => ({
        ok: true as const,
        html: articleHtml('网络'),
        finalUrl: url,
      }),
    })
    const { result } = renderHook(() =>
      useArticlePreview('https://example.com/live', { snapshotHash: HASH })
    )

    await waitFor(() => expect(result.current.state.view).toBe('preview'))
    const state = result.current.state
    if (state.view !== 'preview') throw new Error('expected preview')
    expect(state.fromSnapshot).toBe(false)
    expect(state.articleHash).toMatch(/^[a-f0-9]{32}$/)
    expect(api.fetchArticle).toHaveBeenCalledWith('https://example.com/live')
  })

  it('快照读取异常时回退网络', async () => {
    const api = installFakeApi({
      getArticle: async () => {
        throw new Error('db down')
      },
      fetchArticle: async (url: string) => ({
        ok: true as const,
        html: articleHtml('回退'),
        finalUrl: url,
      }),
    })
    const { result } = renderHook(() =>
      useArticlePreview('https://example.com/live', { snapshotHash: HASH })
    )
    await waitFor(() => expect(result.current.state.view).toBe('preview'))
    expect(api.fetchArticle).toHaveBeenCalled()
  })

  it('非法快照 hash 被忽略，直接走网络', async () => {
    const api = installFakeApi({
      fetchArticle: async (url: string) => ({
        ok: true as const,
        html: articleHtml('直连'),
        finalUrl: url,
      }),
    })
    renderHook(() => useArticlePreview('https://example.com/live', { snapshotHash: 'bad-hash' }))
    await waitFor(() => expect(api.fetchArticle).toHaveBeenCalled())
    expect(api.getArticle).not.toHaveBeenCalled()
  })
})

describe('useArticlePreview：抓取与错误', () => {
  it('没有 url 与快照时停留在加载态', async () => {
    const api = installFakeApi()
    const { result } = renderHook(() => useArticlePreview(''))
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(result.current.state).toEqual({ view: 'loading', stage: 'request' })
    expect(api.fetchArticle).not.toHaveBeenCalled()
  })

  it('抓取失败进入错误态并保留失败原因', async () => {
    installFakeApi({
      fetchArticle: async () => ({
        ok: false as const,
        error: { kind: 'timeout' as const, message: '请求超时' },
      }),
    })
    const { result } = renderHook(() => useArticlePreview('https://example.com/slow'))
    await waitFor(() => expect(result.current.state.view).toBe('error'))
    const state = result.current.state
    if (state.view !== 'error') throw new Error('expected error')
    expect(state.error).toEqual({ kind: 'timeout', message: '请求超时' })
  })

  it('抓取抛错时降级为网络错误文案', async () => {
    installFakeApi({
      fetchArticle: async () => {
        throw new Error('boom')
      },
    })
    const { result } = renderHook(() => useArticlePreview('https://example.com/x'))
    await waitFor(() => expect(result.current.state.view).toBe('error'))
    const state = result.current.state
    if (state.view !== 'error') throw new Error('expected error')
    expect(state.error).toEqual({ kind: 'network', message: '连接中断，请稍后重试。' })
  })

  it('提取失败归类为 extract 错误', async () => {
    installFakeApi({
      fetchArticle: async (url: string) => ({
        ok: true as const,
        html: '<html><body><p>太短</p></body></html>',
        finalUrl: url,
      }),
    })
    const { result } = renderHook(() => useArticlePreview('https://example.com/live'))
    await waitFor(() => expect(result.current.state.view).toBe('error'))
    const state = result.current.state
    if (state.view !== 'error') throw new Error('expected error')
    expect(state.error.kind).toBe('extract')
    expect(state.error.message.length).toBeGreaterThan(0)
  })

  it('图片下载整体失败时保留预览并把图片标记失败', async () => {
    installFakeApi({
      fetchArticle: async (url: string) => ({
        ok: true as const,
        html: `<html><body><article><h1>图</h1><p>${'正文足够长。'.repeat(40)}</p><img src="https://example.com/a.png"></article></body></html>`,
        finalUrl: url,
      }),
      downloadImages: async () => {
        throw new Error('network')
      },
    })
    const { result } = renderHook(() => useArticlePreview('https://example.com/live'))
    await waitFor(() => expect(result.current.state.view).toBe('preview'))
    await waitFor(() => {
      const state = result.current.state
      if (state.view !== 'preview') return
      expect(state.article.images.every((image) => image.status === 'failed')).toBe(true)
    })
  })
})

describe('useArticlePreview：刷新与竞态', () => {
  it('刷新失败保留上一份预览并回显 refreshError', async () => {
    let calls = 0
    installFakeApi({
      fetchArticle: async (url: string): Promise<FetchResult> => {
        calls += 1
        if (calls === 1) return { ok: true, html: articleHtml('首屏'), finalUrl: url }
        return { ok: false, error: { kind: 'network', message: '刷新失败' } }
      },
    })
    const { result } = renderHook(() => useArticlePreview('https://example.com/live'))
    await waitFor(() => expect(result.current.state.view).toBe('preview'))

    act(() => result.current.refresh())
    await waitFor(() => {
      const state = result.current.state
      expect(state.view === 'preview' && state.refreshError).toBe('刷新失败')
    })
    const state = result.current.state
    if (state.view !== 'preview') throw new Error('expected preview')
    expect(state.article.title).toBe('首屏')
  })

  it('刷新即使有快照也强制走网络', async () => {
    const api = installFakeApi({
      getArticle: async () => storedArticle(),
      fetchArticle: async (url: string) => ({
        ok: true as const,
        html: articleHtml('重新抓取'),
        finalUrl: url,
      }),
    })
    const { result } = renderHook(() =>
      useArticlePreview('https://example.com/live', { snapshotHash: HASH })
    )
    await waitFor(() => expect(result.current.state.view).toBe('preview'))

    act(() => result.current.refresh())
    await waitFor(() => expect(api.fetchArticle).toHaveBeenCalled())

    await waitFor(() => {
      const state = result.current.state
      expect(state.view === 'preview' && state.fromSnapshot).toBe(false)
    })
  })

  it('旧请求晚到时不覆盖新结果', async () => {
    let resolveFirst: (result: FetchResult) => void = () => {}
    installFakeApi({
      fetchArticle: (url: string) => {
        if (url.includes('first')) {
          return new Promise<FetchResult>((resolve) => {
            resolveFirst = resolve
          })
        }
        return Promise.resolve({ ok: true as const, html: articleHtml('第二次'), finalUrl: url })
      },
    })

    const { result, rerender } = renderHook(
      (props: { url: string }) => useArticlePreview(props.url),
      { initialProps: { url: 'https://example.com/first' } }
    )
    rerender({ url: 'https://example.com/second' })

    await waitFor(() => {
      const state = result.current.state
      expect(state.view === 'preview' && state.article.title).toBe('第二次')
    })

    await act(async () => {
      resolveFirst({ ok: true, html: articleHtml('第一次'), finalUrl: 'https://example.com/first' })
      await new Promise((resolve) => setTimeout(resolve, 30))
    })

    const state = result.current.state
    if (state.view !== 'preview') throw new Error('expected preview')
    expect(state.article.title).toBe('第二次')
  })
})
