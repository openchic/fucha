import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dropdown } from '@renderer/components/Dropdown'

const options = [
  { value: 'default', label: '雾紫', hint: '默认' },
  { value: 'shujuan', label: '书卷' },
  { value: 'qingci', label: '青瓷' },
]

function setup(
  props: { value?: string; onChange?: (value: string) => void; withActions?: boolean } = {}
) {
  const onChange = props.onChange ?? vi.fn()
  const onAction = vi.fn()
  const current = options.find((option) => option.value === (props.value ?? 'default'))!
  const view = render(
    <Dropdown
      label="主题"
      value={props.value ?? 'default'}
      options={options}
      actions={props.withActions ? [{ label: '管理主题', onSelect: onAction }] : undefined}
      onChange={onChange}
    />
  )
  const trigger = screen.getByRole('button', { name: `主题：${current.label}` })
  return { ...view, trigger, onChange, onAction }
}

async function expectClosed(): Promise<void> {
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
}

describe('Dropdown', () => {
  it('初始折叠并展示当前选项', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('点击展开选项列表', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: '主题' })
    expect(listbox).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('当前选项标记 aria-selected 与勾选图标', async () => {
    const { trigger } = setup({ value: 'shujuan' })
    await userEvent.click(trigger)

    const selected = screen.getByRole('option', { name: /书卷/ })
    expect(selected).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: /雾紫/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('展示选项提示文字', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    expect(screen.getByText('默认')).toBeInTheDocument()
  })

  it('选择选项后回传并关闭', async () => {
    const { trigger, onChange } = setup()
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('option', { name: /青瓷/ }))

    expect(onChange).toHaveBeenCalledWith('qingci')
    await expectClosed()
  })

  it('打开时焦点落在当前选项', async () => {
    const { trigger } = setup({ value: 'shujuan' })
    await userEvent.click(trigger)
    await waitFor(() => expect(screen.getByRole('option', { name: /书卷/ })).toHaveFocus())
  })

  it('方向键在选项间移动焦点', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /书卷/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: /青瓷/ })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { name: /书卷/ })).toHaveFocus()
  })

  it('Home 与 End 跳到首尾', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)

    await userEvent.keyboard('{End}')
    expect(screen.getByRole('option', { name: /青瓷/ })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('option', { name: /雾紫/ })).toHaveFocus()
  })

  it('触发器方向键直接展开', async () => {
    const { trigger } = setup()
    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('Escape 关闭并把焦点还给触发器', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await expectClosed()
    expect(trigger).toHaveFocus()
  })

  it('点击外部关闭', async () => {
    const { trigger } = setup()
    await userEvent.click(trigger)
    await userEvent.click(document.body)
    await expectClosed()
  })

  it('动作项只出现在配置后，点击后关闭并回调', async () => {
    const { trigger, onAction } = setup({ withActions: true })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: '管理主题' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    await expectClosed()
  })
})
