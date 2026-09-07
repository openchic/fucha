import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Segmented } from '@renderer/components/Segmented'

const options = [
  { value: 'font', label: '字体' },
  { value: 'color', label: '颜色' },
  { value: 'layout', label: '排版' },
] as const

describe('Segmented', () => {
  it('渲染 tablist 与全部选项', () => {
    render(
      <Segmented
        label="主题分组"
        value="color"
        options={options}
        idPrefix="group"
        panelId="panel"
        onChange={() => {}}
      />
    )
    expect(screen.getByRole('tablist', { name: '主题分组' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('只标记当前选项为选中', () => {
    render(
      <Segmented
        label="主题分组"
        value="color"
        options={options}
        idPrefix="group"
        panelId="panel"
        onChange={() => {}}
      />
    )
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'false')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('每个 tab 指向同一面板', () => {
    render(
      <Segmented
        label="主题分组"
        value="font"
        options={options}
        idPrefix="group"
        panelId="theme-panel"
        onChange={() => {}}
      />
    )
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-controls', 'theme-panel')
    }
    expect(screen.getByRole('tab', { name: '字体' })).toHaveAttribute('id', 'group-font')
  })

  it('点击切换时回传选项值', async () => {
    const onChange = vi.fn()
    render(
      <Segmented
        label="主题分组"
        value="font"
        options={options}
        idPrefix="group"
        panelId="panel"
        onChange={onChange}
      />
    )

    await userEvent.click(screen.getByRole('tab', { name: '排版' }))
    expect(onChange).toHaveBeenCalledWith('layout')
  })
})
