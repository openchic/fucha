import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tooltip } from '@renderer/components/Tooltip'

describe('Tooltip', () => {
  it('把提示与触发元素关联', () => {
    render(
      <Tooltip label="收起侧栏">
        <button type="button">触发</button>
      </Tooltip>
    )
    const trigger = screen.getByRole('button', { name: '触发' })
    const tooltip = screen.getByRole('tooltip')
    expect(trigger).toHaveAttribute('aria-describedby', tooltip.id)
    expect(tooltip).toHaveTextContent('收起侧栏')
  })

  it('渲染快捷键提示', () => {
    render(
      <Tooltip label="展开" shortcut="⌘B">
        <button type="button">触发</button>
      </Tooltip>
    )
    expect(screen.getByRole('tooltip')).toHaveTextContent('展开⌘B')
  })

  it('hidden 时隐藏提示但保留节点', () => {
    render(
      <Tooltip label="展开" hidden>
        <button type="button">触发</button>
      </Tooltip>
    )
    expect(screen.getByRole('tooltip')).toHaveClass('hidden')
  })

  it('没有 hidden 时不使用 hidden 类', () => {
    render(
      <Tooltip label="展开">
        <button type="button">触发</button>
      </Tooltip>
    )
    expect(screen.getByRole('tooltip')).not.toHaveClass('hidden')
  })
})
