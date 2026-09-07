import type { StoredArticle } from '@shared/store-types'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { PageBridgeContext, type PageBridgeApi } from '@shared/pageBridge'
import Preview from '@renderer/pages/Preview'
import { installFakeApi } from '../../setup/fake-api'

const HASH = 'c'.repeat(32)

function storedArticle(): StoredArticle {
  return {
    hash: HASH,
    sourceUrl: 'https://example.com/saved',
    finalUrl: 'https://example.com/saved',
    title: '已保存的文章',
    html: '<p>已保存正文</p>',
    themeId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    visitCount: 1,
    images: [],
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderPreview(entry = `/preview?url=https%3A%2F%2Fexample.com%2Farticle`) {
  const bridge: PageBridgeApi = { setPage: vi.fn(), refreshHistory: vi.fn() }
  render(
    <PageBridgeContext.Provider value={bridge}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/preview"
            element={
              <>
                <Preview />
                <LocationProbe />
              </>
            }
          />
          <Route path="/" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </PageBridgeContext.Provider>
  )
  return bridge
}

describe('Preview 页面', () => {
  it('缺少 url 与合法 hash 时回到首页', async () => {
    renderPreview('/preview')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/))
  })

  it('加载中展示请求态与取消按钮', async () => {
    installFakeApi({
      fetchArticle: () =>
        new Promise(() => {
          // 保持挂起以观察加载态
        }),
    })
    renderPreview()
    expect(await screen.findByText('正在请求，请稍候…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
  })

  it('抓取失败展示错误分类并可重试', async () => {
    const api = installFakeApi({
      fetchArticle: async () => ({
        ok: false as const,
        error: { kind: 'timeout' as const, message: '请求超时' },
      }),
    })
    renderPreview()

    expect(await screen.findByRole('heading', { name: '请求超时' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /重新尝试/ }))
    await waitFor(() => expect(api.fetchArticle).toHaveBeenCalledTimes(2))
  })

  it('错误态可以返回修改链接', async () => {
    installFakeApi({
      fetchArticle: async () => ({
        ok: false as const,
        error: { kind: 'network' as const, message: '断网了' },
      }),
    })
    renderPreview()

    await userEvent.click(await screen.findByRole('button', { name: '返回修改链接' }))
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/?url=https%3A%2F%2Fexample.com%2Farticle'
      )
    )
  })

  it('快照预览展示标题、复制与主题入口', async () => {
    const api = installFakeApi({ getArticle: async () => storedArticle() })
    renderPreview(`/preview?url=https%3A%2F%2Fexample.com%2Fsaved&hash=${HASH}`)

    expect(await screen.findByRole('heading', { name: '已保存的文章' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新提取' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '手机预览' })).toBeInTheDocument()
    await waitFor(() => expect(api.touchArticle).toHaveBeenCalledWith(HASH))
    expect(api.saveArticle).not.toHaveBeenCalled()
  })

  it('切换主题写入文章与偏好', async () => {
    const api = installFakeApi({ getArticle: async () => storedArticle() })
    renderPreview(`/preview?url=https%3A%2F%2Fexample.com%2Fsaved&hash=${HASH}`)

    await screen.findByRole('heading', { name: '已保存的文章' })
    await userEvent.click(screen.getByRole('button', { name: '主题：雾紫' }))
    await userEvent.click(screen.getByRole('option', { name: /书卷/ }))

    await waitFor(() => expect(api.setArticleTheme).toHaveBeenCalledWith(HASH, 'shujuan'))
    expect(api.setPreference).toHaveBeenCalledWith('theme.active', 'shujuan')
  })

  it('复制成功后提示已复制', async () => {
    installFakeApi({
      getArticle: async () => storedArticle(),
      exportHtml: async () => '<section>导出</section>',
    })
    renderPreview(`/preview?url=https%3A%2F%2Fexample.com%2Fsaved&hash=${HASH}`)

    await screen.findByRole('heading', { name: '已保存的文章' })
    await userEvent.click(screen.getByRole('button', { name: '复制' }))
    expect(await screen.findByText('已复制到剪贴板')).toBeInTheDocument()
  })
})
