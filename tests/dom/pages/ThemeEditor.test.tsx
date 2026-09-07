import type { ThemeRecord } from '@shared/store-types'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import Settings from '@renderer/pages/Settings'
import ThemeEditorPage from '@renderer/pages/Settings/Themes/Editor'
import { ConfirmProvider } from '@renderer/components/ConfirmDialog'
import { DEFAULT_THEME } from '@renderer/theme/presets'
import { installFakeApi, stubThemeRecord } from '../../setup/fake-api'

const customToken = {
  ...structuredClone(DEFAULT_THEME.token),
  id: 'custom-a',
  name: '自定义甲',
  builtin: false,
}

function customRecord(): ThemeRecord {
  return stubThemeRecord(customToken, '')
}

function stubMatchMedia(): void {
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

function renderEditor(entry: string) {
  stubMatchMedia()
  const api = installFakeApi({ listThemes: async () => [customRecord()] })
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ConfirmProvider>
        <Routes>
          <Route path="/settings" element={<Settings />}>
            <Route index element={<div>主题列表</div>} />
            <Route path="themes" element={<div>主题列表</div>} />
            <Route path="themes/new" element={<ThemeEditorPage />} />
            <Route path="themes/:id" element={<ThemeEditorPage />} />
          </Route>
        </Routes>
      </ConfirmProvider>
    </MemoryRouter>
  )
  return api
}

async function openName(): Promise<HTMLInputElement> {
  return (await screen.findByRole('textbox', { name: '主题名称' })) as HTMLInputElement
}

describe('主题编辑器：新建', () => {
  beforeEach(() => localStorage.clear())

  it('默认名称并自动聚焦', async () => {
    renderEditor('/settings/themes/new')
    const input = await openName()
    expect(input).toHaveValue('新主题')
    await waitFor(() => expect(input).toHaveFocus())
    expect(screen.getByRole('heading', { name: '新建主题' })).toBeInTheDocument()
  })

  it('名称为空时阻止创建并提示', async () => {
    const api = renderEditor('/settings/themes/new')
    const input = await openName()
    await userEvent.clear(input)
    await userEvent.click(screen.getByRole('button', { name: '创建主题' }))

    expect(screen.getByRole('alert')).toHaveTextContent('请输入主题名称')
    expect(api.createTheme).not.toHaveBeenCalled()
  })

  it('创建成功后调用接口并回到列表', async () => {
    const api = renderEditor('/settings/themes/new')
    const input = await openName()
    await userEvent.clear(input)
    await userEvent.type(input, '我的主题')
    await userEvent.click(screen.getByRole('button', { name: '创建主题' }))

    await waitFor(() => expect(api.createTheme).toHaveBeenCalledTimes(1))
    const inputArg = vi.mocked(api.createTheme).mock.calls[0]![0]
    expect(inputArg.token.name).toBe('我的主题')
    expect(inputArg.token.id).toMatch(/^custom-/)
    expect(inputArg.token.builtin).toBe(false)
    expect(await screen.findByText('主题列表')).toBeInTheDocument()
  })

  it('名称冲突时展示清理后的错误', async () => {
    const api = installFakeApi({
      listThemes: async () => [customRecord()],
      createTheme: async () => {
        throw new Error(
          "Error invoking remote method 'themes:create': Error: 主题名称已存在：自定义甲"
        )
      },
    })
    stubMatchMedia()
    render(
      <MemoryRouter initialEntries={['/settings/themes/new']}>
        <ConfirmProvider>
          <Routes>
            <Route path="/settings" element={<Settings />}>
              <Route path="themes" element={<div>主题列表</div>} />
              <Route path="themes/new" element={<ThemeEditorPage />} />
            </Route>
          </Routes>
        </ConfirmProvider>
      </MemoryRouter>
    )
    const input = await openName()
    await userEvent.clear(input)
    await userEvent.type(input, '自定义甲')
    await userEvent.click(screen.getByRole('button', { name: '创建主题' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('主题名称已存在：自定义甲')
    )
    expect(api.createTheme).toHaveBeenCalled()
  })
})

describe('主题编辑器：编辑与取消', () => {
  it('保存调用更新接口并回到列表', async () => {
    const api = renderEditor('/settings/themes/custom-a')
    expect(await screen.findByRole('heading', { name: '编辑主题' })).toBeInTheDocument()
    expect(await openName()).toHaveValue('自定义甲')

    await userEvent.click(screen.getByRole('tab', { name: '排版' }))
    await userEvent.click(screen.getAllByRole('button', { name: '增大字号' })[0]!)
    expect(screen.getByText('未保存')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(api.updateTheme).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.updateTheme).mock.calls[0]![0].id).toBe('custom-a')
    expect(await screen.findByText('主题列表')).toBeInTheDocument()
  })

  it('没有修改时取消直接回到列表', async () => {
    const api = renderEditor('/settings/themes/custom-a')
    await screen.findByRole('heading', { name: '编辑主题' })
    await userEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(await screen.findByText('主题列表')).toBeInTheDocument()
    expect(api.updateTheme).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('有修改时取消需要确认，放弃后不保存', async () => {
    const api = renderEditor('/settings/themes/custom-a')
    await screen.findByRole('heading', { name: '编辑主题' })

    await userEvent.click(screen.getByRole('tab', { name: '排版' }))
    await userEvent.click(screen.getAllByRole('button', { name: '增大字号' })[0]!)
    await userEvent.click(screen.getByRole('button', { name: '取消' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('放弃未保存的主题调整？')
    await userEvent.click(screen.getByRole('button', { name: '放弃' }))

    expect(await screen.findByText('主题列表')).toBeInTheDocument()
    expect(api.updateTheme).not.toHaveBeenCalled()
  })

  it('有修改时返回按钮同样触发确认', async () => {
    renderEditor('/settings/themes/custom-a')
    await screen.findByRole('heading', { name: '编辑主题' })

    await userEvent.click(screen.getByRole('tab', { name: '排版' }))
    await userEvent.click(screen.getAllByRole('button', { name: '增大字号' })[0]!)
    await userEvent.click(screen.getByRole('button', { name: '返回主题管理' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
