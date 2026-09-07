import type { ThemeToken } from '@shared/types'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemePanel } from '@renderer/components/ThemePanel'
import { DEFAULT_THEME } from '@renderer/theme/presets'

const baseline = structuredClone(DEFAULT_THEME.token)

function renderPanel(mutate: (token: ThemeToken) => void = () => {}) {
  const token = structuredClone(baseline)
  mutate(token)
  const onTokenChange = vi.fn()
  const view = render(
    <ThemePanel
      theme={{ token, css: '' }}
      baseline={baseline}
      title="主题编辑"
      header={<div>头部</div>}
      footer={<div>底部</div>}
      onTokenChange={onTokenChange}
    />
  )
  return { ...view, token, onTokenChange }
}

describe('ThemePanel：分组切换', () => {
  it('默认展示颜色分组', () => {
    renderPanel()
    expect(screen.getByRole('region', { name: '主题编辑' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('tab', { name: '颜色' })).toHaveAttribute('aria-selected', 'true')
    for (const name of ['基础', '背景', '线条']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument()
    }
  })

  it('渲染 header 与 footer', () => {
    renderPanel()
    expect(screen.getByText('头部')).toBeInTheDocument()
    expect(screen.getByText('底部')).toBeInTheDocument()
  })

  it('切换到排版分组', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('tab', { name: '排版' }))

    expect(screen.getByRole('tab', { name: '排版' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'theme-tab-typography')
    expect(screen.getByRole('heading', { name: '正文' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '标题' })).toBeInTheDocument()
  })

  it.each(['代码', '页面'])('切换到 %s 分组', async (tab) => {
    renderPanel()
    await userEvent.click(screen.getByRole('tab', { name: tab }))
    expect(screen.getByRole('tabpanel')).toBeInTheDocument()
  })
})

describe('ThemePanel：修改 token', () => {
  it('调整正文字号时回传完整 token', async () => {
    const { onTokenChange, token } = renderPanel()
    await userEvent.click(screen.getByRole('tab', { name: '排版' }))

    await userEvent.click(screen.getAllByRole('button', { name: '增大字号' })[0]!)

    expect(onTokenChange).toHaveBeenCalledTimes(1)
    const next = onTokenChange.mock.calls[0]![0] as ThemeToken
    expect(next.text.fontSize).toBe(token.text.fontSize + 1)
    expect(next.primary).toBe(token.primary)
    expect(next.h1).toEqual(token.h1)
  })

  it('切换标题层级后修改只影响当前层级', async () => {
    const { onTokenChange, token } = renderPanel()
    await userEvent.click(screen.getByRole('tab', { name: '排版' }))

    await userEvent.click(screen.getByRole('button', { name: '标题层级：h1' }))
    await userEvent.click(screen.getByRole('option', { name: 'h3' }))

    await userEvent.click(screen.getAllByRole('button', { name: '增大字号' })[1]!)

    const next = onTokenChange.mock.calls[0]![0] as ThemeToken
    expect(next.h3.fontSize).toBe(token.h3.fontSize + 1)
    expect(next.h1).toEqual(token.h1)
    expect(next.h2).toEqual(token.h2)
  })

  it('打开颜色选择器并展示当前色值', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: '选择主题色' }))

    expect(await screen.findByRole('dialog', { name: '选择主题色' })).toBeInTheDocument()
    expect(screen.getByText('#A8B9F0')).toBeInTheDocument()
  })
})

describe('ThemePanel：重置与对比度提示', () => {
  it('未修改时不显示重置按钮', () => {
    renderPanel()
    expect(screen.queryByRole('button', { name: /重置正文色/ })).not.toBeInTheDocument()
  })

  it('修改后显示重置按钮，点击恢复保存值', async () => {
    const { onTokenChange } = renderPanel((token) => {
      token.text.color = '#111111'
    })
    const reset = screen.getByRole('button', { name: '重置正文色为保存值' })
    await userEvent.click(reset)

    const next = onTokenChange.mock.calls[0]![0] as ThemeToken
    expect(next.text.color).toBe(baseline.text.color)
  })

  it('颜色对比度过低时给出警告', () => {
    renderPanel((token) => {
      token.text.color = '#ffffff'
    })
    expect(screen.getByText('与白底 1.00:1，低于 4.5:1')).toBeInTheDocument()
  })

  it('默认颜色不给出警告', () => {
    renderPanel()
    expect(screen.queryByText(/低于 4.5:1/)).not.toBeInTheDocument()
  })
})
