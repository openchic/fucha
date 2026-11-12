import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import Settings from '@renderer/pages/Settings'
import ThemeList from '@renderer/pages/Settings/Themes'
import { ConfirmProvider } from '@renderer/components/ConfirmDialog'
import { DEFAULT_THEME } from '@renderer/theme/presets'
import { installFakeApi, stubThemeRecord } from '../../setup/fake-api'

const customToken = {
  ...structuredClone(DEFAULT_THEME.token),
  id: 'custom-a',
  name: '自定义甲',
  builtin: false,
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function stubMatchMedia(): void {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

function renderList(options: { customThemes?: boolean } = {}) {
  stubMatchMedia()
  const api = installFakeApi({
    listThemes: async () =>
      options.customThemes === false ? [] : [stubThemeRecord(customToken, '')],
  })
  render(
    <MemoryRouter initialEntries={['/settings/themes']}>
      <ConfirmProvider>
        <Routes>
          <Route path="/settings" element={<Settings />}>
            <Route path="themes" element={<ThemeList />} />
            <Route
              path="themes/new"
              element={
                <>
                  <div>新建页</div>
                  <LocationProbe />
                </>
              }
            />
            <Route
              path="themes/:id"
              element={
                <>
                  <div>编辑页</div>
                  <LocationProbe />
                </>
              }
            />
          </Route>
        </Routes>
      </ConfirmProvider>
    </MemoryRouter>
  )
  return api
}

describe('主题列表', () => {
  it('展示内置与自定义主题，内置只读', async () => {
    renderList()
    expect(await screen.findByRole('heading', { name: '内置主题' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '另存为' })).toHaveLength(3)
    expect(screen.getByText('自定义甲')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument()
    expect(screen.getAllByText('内置 · 只读')).toHaveLength(3)
  })

  it('没有自定义主题时展示引导文案', async () => {
    renderList({ customThemes: false })
    expect(await screen.findByText(/还没有自定义主题/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument()
  })

  it('另存为进入新建页并携带来源', async () => {
    renderList()
    const buttons = await screen.findAllByRole('button', { name: '另存为' })
    await userEvent.click(buttons[0]!)

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/settings/themes/new?from=default')
    )
  })

  it('编辑自定义主题进入编辑页', async () => {
    renderList()
    await userEvent.click(await screen.findByRole('button', { name: '编辑' }))

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/settings/themes/custom-a')
    )
  })

  it('删除需要确认，确认后调用删除并刷新列表', async () => {
    const api = renderList()
    await screen.findByText('自定义甲')

    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '删除' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/自定义甲/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: '删除' }))

    await waitFor(() => expect(api.deleteTheme).toHaveBeenCalledWith('custom-a'))
    await waitFor(() => expect(api.listThemes).toHaveBeenCalledTimes(2))
  })

  it('取消删除不调用接口', async () => {
    const api = renderList()
    await screen.findByText('自定义甲')

    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '删除' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '取消' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.deleteTheme).not.toHaveBeenCalled()
  })

  it('删除失败时展示清理后的错误', async () => {
    const api = renderList()
    vi.mocked(api.deleteTheme).mockRejectedValueOnce(
      new Error("Error invoking remote method 'themes:delete': Error: 主题仍被 1 篇文章引用")
    )
    await screen.findByText('自定义甲')

    await userEvent.click(screen.getByRole('button', { name: '更多操作' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '删除' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '删除' }))

    expect(await screen.findByText('主题仍被 1 篇文章引用')).toBeInTheDocument()
  })
})
