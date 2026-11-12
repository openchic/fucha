import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useSidebarCollapsed } from '@renderer/hooks/useSidebarCollapsed'

function pressB(init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true, ...init })
  window.dispatchEvent(event)
  return event
}

describe('useSidebarCollapsed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('默认展开', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(false)
  })

  it('读取已保存的收起状态', () => {
    localStorage.setItem('sidebar.collapsed', '1')
    const { result } = renderHook(() => useSidebarCollapsed())
    expect(result.current.collapsed).toBe(true)
  })

  it('toggle 切换并写入偏好', () => {
    const { result } = renderHook(() => useSidebarCollapsed())

    act(() => result.current.toggle())
    expect(result.current.collapsed).toBe(true)
    expect(localStorage.getItem('sidebar.collapsed')).toBe('1')

    act(() => result.current.toggle())
    expect(result.current.collapsed).toBe(false)
    expect(localStorage.getItem('sidebar.collapsed')).toBe('0')
  })

  it('⌘B 与 Ctrl+B 都触发切换', () => {
    const { result } = renderHook(() => useSidebarCollapsed())

    act(() => {
      pressB({ metaKey: true })
    })
    expect(result.current.collapsed).toBe(true)

    act(() => {
      pressB({ ctrlKey: true })
    })
    expect(result.current.collapsed).toBe(false)
  })

  it('快捷键阻止默认行为', () => {
    renderHook(() => useSidebarCollapsed())
    const event = pressB({ metaKey: true })
    expect(event.defaultPrevented).toBe(true)
  })

  it('普通 b 键不触发', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    act(() => {
      pressB()
    })
    expect(result.current.collapsed).toBe(false)
  })

  it('输入框内不劫持快捷键', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    const input = document.createElement('input')
    document.body.append(input)

    const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true, bubbles: true })
    input.dispatchEvent(event)

    expect(result.current.collapsed).toBe(false)
    expect(event.defaultPrevented).toBe(false)
    input.remove()
  })

  it('textarea 与 contenteditable 内同样不劫持', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.append(textarea, editable)

    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }))
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true }))

    expect(result.current.collapsed).toBe(false)
    textarea.remove()
    editable.remove()
  })

  it('大写 B 也能匹配', () => {
    const { result } = renderHook(() => useSidebarCollapsed())
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'B', metaKey: true, cancelable: true })
      )
    })
    expect(result.current.collapsed).toBe(true)
  })

  it('卸载后移除键盘监听', () => {
    const { unmount } = renderHook(() => useSidebarCollapsed())
    unmount()
    const event = pressB({ metaKey: true })
    expect(event.defaultPrevented).toBe(false)
    expect(localStorage.getItem('sidebar.collapsed')).toBeNull()
  })
})
