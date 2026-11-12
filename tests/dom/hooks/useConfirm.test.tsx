import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmProvider } from '@renderer/components/ConfirmDialog'
import { useConfirm, type ConfirmFn } from '@renderer/hooks/useConfirm'

function Harness({ onReady }: { onReady: (confirm: ConfirmFn) => void }) {
  const confirm = useConfirm()
  onReady(confirm)
  return <button type="button">打开</button>
}

function setup() {
  let confirm: ConfirmFn = async () => false
  render(
    <ConfirmProvider>
      <Harness onReady={(fn) => (confirm = fn)} />
    </ConfirmProvider>
  )
  return { confirm: () => confirm }
}

describe('useConfirm / ConfirmProvider', () => {
  it('在 Provider 外使用会抛错', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useConfirm())).toThrow('useConfirm 必须在 ConfirmProvider 内使用')
    spy.mockRestore()
  })

  it('打开后展示标题与描述，焦点落在取消按钮', async () => {
    const { confirm } = setup()
    act(() => {
      void confirm()({ title: '删除文章', description: '删除后不可恢复' })
    })

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('删除文章')).toBeInTheDocument()
    expect(screen.getByText('删除后不可恢复')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toHaveFocus())
  })

  it('点击确认返回 true', async () => {
    const { confirm } = setup()
    let settled: boolean | null = null
    act(() => {
      void confirm()({ title: '继续？' }).then((value) => (settled = value))
    })

    await userEvent.click(await screen.findByRole('button', { name: '确定' }))
    await waitFor(() => expect(settled).toBe(true))
  })

  it('点击取消返回 false', async () => {
    const { confirm } = setup()
    let settled: boolean | null = null
    act(() => {
      void confirm()({ title: '继续？' }).then((value) => (settled = value))
    })

    await userEvent.click(await screen.findByRole('button', { name: '取消' }))
    await waitFor(() => expect(settled).toBe(false))
  })

  it('Esc 取消', async () => {
    const { confirm } = setup()
    let settled: boolean | null = null
    act(() => {
      void confirm()({ title: '继续？' }).then((value) => (settled = value))
    })

    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(settled).toBe(false))
  })

  it('点击遮罩取消', async () => {
    const { confirm } = setup()
    let settled: boolean | null = null
    act(() => {
      void confirm()({ title: '继续？' }).then((value) => (settled = value))
    })

    const dialog = await screen.findByRole('dialog')
    fireEvent.pointerDown(dialog.parentElement!)
    await waitFor(() => expect(settled).toBe(false))
  })

  it('点击对话框内部不会关闭', async () => {
    const { confirm } = setup()
    let settled: boolean | null = null
    act(() => {
      void confirm()({ title: '继续？' }).then((value) => (settled = value))
    })

    const dialog = await screen.findByRole('dialog')
    fireEvent.pointerDown(dialog)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(settled).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('自定义按钮文案与危险色调', async () => {
    const { confirm } = setup()
    act(() => {
      void confirm()({
        title: '删除',
        confirmLabel: '删除',
        cancelLabel: '算了',
        tone: 'danger',
      })
    })

    expect(await screen.findByRole('button', { name: '删除' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '算了' })).toBeInTheDocument()
  })

  it('连续调用按队列依次展示', async () => {
    const { confirm } = setup()
    act(() => {
      void confirm()({ title: '第一个' })
      void confirm()({ title: '第二个' })
    })

    expect(await screen.findByText('第一个')).toBeInTheDocument()
    expect(screen.queryByText('第二个')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '确定' }))
    expect(await screen.findByText('第二个')).toBeInTheDocument()
  })

  it('关闭后焦点回到打开前的元素', async () => {
    const outside = document.createElement('button')
    outside.textContent = '外部按钮'
    document.body.append(outside)
    outside.focus()

    const { confirm } = setup()
    act(() => {
      void confirm()({ title: '继续？' })
    })
    await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toHaveFocus())

    await userEvent.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(outside).toHaveFocus())
    outside.remove()
  })

  it('对话框内 Tab 在两个按钮之间循环', async () => {
    const { confirm } = setup()
    act(() => {
      void confirm()({ title: '继续？' })
    })

    const cancel = await screen.findByRole('button', { name: '取消' })
    const confirmButton = screen.getByRole('button', { name: '确定' })
    await waitFor(() => expect(cancel).toHaveFocus())

    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(confirmButton).toHaveFocus()

    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(cancel).toHaveFocus()
  })
})
