import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberInput } from '@renderer/components/NumberInput'

type Props = {
  value?: number
  min?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
  describedBy?: string
}

function setup(props: Props = {}) {
  const onChange = props.onChange ?? vi.fn()
  const view = render(
    <NumberInput
      label="字号"
      value={props.value ?? 14}
      min={props.min ?? 12}
      max={props.max ?? 20}
      step={props.step ?? 1}
      unit="px"
      describedBy={props.describedBy}
      onChange={onChange}
    />
  )
  const input = screen.getByRole('spinbutton', { name: '字号' }) as HTMLInputElement
  return { ...view, input, onChange }
}

describe('NumberInput', () => {
  it('展示当前值与单位', () => {
    const { input } = setup()
    expect(input).toHaveValue(14)
    expect(screen.getByText('px')).toBeInTheDocument()
  })

  it('点击加号按步长递增', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '增大字号' }))
    expect(onChange).toHaveBeenCalledWith(15)
  })

  it('点击减号按步长递减', async () => {
    const { onChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: '减小字号' }))
    expect(onChange).toHaveBeenCalledWith(13)
  })

  it('到达下限时减号禁用，到达上限时加号禁用', () => {
    const { unmount } = setup({ value: 12 })
    expect(screen.getByRole('button', { name: '减小字号' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '增大字号' })).toBeEnabled()
    unmount()

    setup({ value: 20 })
    expect(screen.getByRole('button', { name: '增大字号' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '减小字号' })).toBeEnabled()
  })

  it('方向键上下步进', async () => {
    const { input, onChange } = setup()
    await userEvent.type(input, '{ArrowUp}')
    expect(onChange).toHaveBeenLastCalledWith(15)
    await userEvent.type(input, '{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith(13)
  })

  it('键入后按 Enter 提交', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '17{Enter}')
    expect(onChange).toHaveBeenCalledWith(17)
  })

  it('提交时按范围钳制', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '99{Enter}')
    expect(onChange).toHaveBeenCalledWith(20)

    await userEvent.clear(input)
    await userEvent.type(input, '-5{Enter}')
    expect(onChange).toHaveBeenLastCalledWith(12)
  })

  it('提交时按步长归整', async () => {
    const { input, onChange } = setup({ min: 1, max: 3, step: 0.05, value: 1.5 })
    await userEvent.clear(input)
    await userEvent.type(input, '1.33{Enter}')
    expect(onChange).toHaveBeenCalledWith(1.35)
  })

  it('失焦时提交草稿', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '16')
    await userEvent.tab()
    expect(onChange).toHaveBeenCalledWith(16)
  })

  it('Esc 放弃草稿且失焦不提交', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.type(input, '18')
    await userEvent.type(input, '{Escape}')
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveValue(14)
  })

  it('空值与非数字不提交', async () => {
    const { input, onChange } = setup()
    await userEvent.clear(input)
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()

    await userEvent.type(input, 'abc')
    await userEvent.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('透传 aria-describedby', () => {
    setup({ describedBy: 'hint-id' })
    expect(screen.getByRole('spinbutton', { name: '字号' })).toHaveAttribute(
      'aria-describedby',
      'hint-id'
    )
  })
})
