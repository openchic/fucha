import type { ArticleSummary } from '@shared/store-types'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useSearchParams } from 'react-router'
import Home from '@renderer/pages/Home'
import { ConfirmProvider } from '@renderer/components/ConfirmDialog'
import { installFakeApi } from '../../setup/fake-api'

type MediaListener = () => void

function stubMatchMedia(): void {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: (_: string, listener: MediaListener) => listeners.push(listener),
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}
const listeners: MediaListener[] = []

function summary(hash: string, title: string): ArticleSummary {
  return {
    hash,
    sourceUrl: `https://example.com/${hash}`,
    finalUrl: `https://example.com/${hash}`,
    title,
    themeId: 'default',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    visitCount: 0,
  }
}

function PreviewProbe() {
  const location = useLocation()
  const [params] = useSearchParams()
  return (
    <div data-testid="preview">
      {location.pathname}?url={params.get('url')}&hash={params.get('hash')}
    </div>
  )
}

function renderHome(items: ArticleSummary[] = []) {
  stubMatchMedia()
  const api = installFakeApi({ listArticles: async () => items })
  render(
    <MemoryRouter initialEntries={['/']}>
      <ConfirmProvider>
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<div>新建页</div>} />
            <Route path="preview" element={<PreviewProbe />} />
          </Route>
          <Route path="/settings/themes" element={<div>设置页</div>} />
        </Routes>
      </ConfirmProvider>
    </MemoryRouter>
  )
  return api
}

describe('Home 布局', () => {
  it('没有历史时展示空态', async () => {
    renderHome()
    expect(await screen.findByText('还没有历史记录')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '最近文章' })).toBeInTheDocument()
  })

  it('展示历史标题与篇数', async () => {
    renderHome([summary('a'.repeat(32), '第一篇文章'), summary('b'.repeat(32), '第二篇文章')])

    expect(await screen.findByRole('button', { name: '第一篇文章' })).toBeInTheDocument()
    expect(screen.getByText('2 篇')).toBeInTheDocument()
  })

  it('点击历史项跳转到预览并携带 hash', async () => {
    renderHome([summary('a'.repeat(32), '第一篇文章')])
    await userEvent.click(await screen.findByRole('button', { name: '第一篇文章' }))

    const preview = await screen.findByTestId('preview')
    expect(preview).toHaveTextContent('/preview?url=https://example.com/')
    expect(preview).toHaveTextContent('hash=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('新建按钮回到首页', async () => {
    renderHome([summary('a'.repeat(32), '第一篇文章')])
    await screen.findByRole('button', { name: '第一篇文章' })
    await userEvent.click(screen.getByRole('button', { name: '新建' }))
    expect(screen.getByText('新建页')).toBeInTheDocument()
  })

  it('设置按钮进入主题设置页', async () => {
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: '设置' }))
    expect(await screen.findByText('设置页')).toBeInTheDocument()
  })

  it('删除历史需要确认，确认后调用删除并刷新列表', async () => {
    const api = renderHome([summary('a'.repeat(32), '要删除的文章')])
    await screen.findByRole('button', { name: '要删除的文章' })

    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '删除' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/要删除的文章/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '删除' }))

    await waitFor(() => expect(api.deleteArticle).toHaveBeenCalledWith('a'.repeat(32)))
    await waitFor(() => expect(api.listArticles).toHaveBeenCalledTimes(2))
  })

  it('取消删除不调用删除接口', async () => {
    const api = renderHome([summary('a'.repeat(32), '保留的文章')])
    await screen.findByRole('button', { name: '保留的文章' })

    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '删除' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '取消' }))

    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(api.deleteArticle).not.toHaveBeenCalled()
  })

  it('⌘B 收起侧栏', async () => {
    renderHome()
    const sidebar = await screen.findByRole('navigation', { name: '最近文章' })
    const wrapper = sidebar.parentElement?.parentElement
    expect(wrapper).not.toBeNull()
    expect(wrapper).not.toHaveAttribute('inert')

    await userEvent.keyboard('{Meta>}b{/Meta}')
    await waitFor(() => expect(wrapper).toHaveAttribute('inert'))
  })
})
