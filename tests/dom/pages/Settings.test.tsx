import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation, useOutletContext } from 'react-router'
import Settings from '@renderer/pages/Settings'
import { installFakeApi } from '../../setup/fake-api'

type SettingsContext = {
  themes: { id: string }[]
  ready: boolean
}

function ChildProbe() {
  const context = useOutletContext<SettingsContext>()
  const location = useLocation()
  return (
    <div data-testid="child">
      {location.pathname}|{context.themes.length}|{String(context.ready)}
    </div>
  )
}

function stubMatchMedia(): void {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

function renderSettings(entry = '/settings') {
  stubMatchMedia()
  const api = installFakeApi()
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<div data-testid="home">首页</div>} />
        <Route path="/settings" element={<Settings />}>
          <Route index element={<ChildProbe />} />
          <Route path="themes" element={<ChildProbe />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  return api
}

describe('Settings 布局', () => {
  it('渲染设置导航并把主题库传给子路由', async () => {
    renderSettings()
    expect(screen.getByRole('navigation', { name: '设置' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '主题管理' })).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('child')).toHaveTextContent('3|true'))
  })

  it('主题管理项标记当前路由', () => {
    renderSettings('/settings/themes')
    expect(screen.getByRole('button', { name: '主题管理' })).toHaveAttribute('aria-current', 'page')
  })

  it('返回按钮回到来源页', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: '返回' }))
    expect(await screen.findByTestId('home')).toBeInTheDocument()
  })

  it('主题管理按钮切换路由', async () => {
    renderSettings()
    await userEvent.click(screen.getByRole('button', { name: '主题管理' }))
    await waitFor(() =>
      expect(screen.getByTestId('child').textContent?.startsWith('/settings/themes|')).toBe(true)
    )
  })

  it('⌘B 收起设置侧栏', async () => {
    renderSettings()
    const nav = screen.getByRole('navigation', { name: '设置' })
    const wrapper = nav.parentElement?.parentElement
    expect(wrapper).not.toHaveAttribute('inert')

    await userEvent.keyboard('{Meta>}b{/Meta}')
    await waitFor(() => expect(wrapper).toHaveAttribute('inert'))
  })
})
