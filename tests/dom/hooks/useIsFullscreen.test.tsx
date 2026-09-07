import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsFullscreen } from '@renderer/hooks/useIsFullscreen'

type MediaListener = () => void

function stubMatchMedia(matches: boolean): { listeners: MediaListener[]; media: MediaQueryList } {
  const listeners: MediaListener[] = []
  const media = {
    matches,
    media: '(display-mode: fullscreen)',
    addEventListener: (_type: string, listener: MediaListener) => listeners.push(listener),
    removeEventListener: (_type: string, listener: MediaListener) => {
      const index = listeners.indexOf(listener)
      if (index >= 0) listeners.splice(index, 1)
    },
  } as unknown as MediaQueryList
  window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia
  return { listeners, media }
}

function setViewport(innerWidth: number, screenWidth: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: innerWidth })
  Object.defineProperty(window.screen, 'width', { configurable: true, value: screenWidth })
}

describe('useIsFullscreen', () => {
  beforeEach(() => {
    setViewport(1024, 1920)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('display-mode 命中时返回 true', () => {
    stubMatchMedia(true)
    const { result } = renderHook(() => useIsFullscreen())
    expect(result.current).toBe(true)
  })

  it('窗口与屏幕尺寸相同时判定为全屏', () => {
    stubMatchMedia(false)
    setViewport(1920, 1920)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 })
    Object.defineProperty(window.screen, 'height', { configurable: true, value: 1080 })
    const { result } = renderHook(() => useIsFullscreen())
    expect(result.current).toBe(true)
  })

  it('普通窗口返回 false', () => {
    stubMatchMedia(false)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    Object.defineProperty(window.screen, 'height', { configurable: true, value: 1080 })
    const { result } = renderHook(() => useIsFullscreen())
    expect(result.current).toBe(false)
  })

  it('窗口 resize 后重新判定', () => {
    stubMatchMedia(false)
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    Object.defineProperty(window.screen, 'height', { configurable: true, value: 1080 })
    const { result } = renderHook(() => useIsFullscreen())
    expect(result.current).toBe(false)

    act(() => {
      setViewport(1920, 1920)
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 })
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(true)
  })

  it('display-mode 变化时重新判定', () => {
    let matches = false
    const listeners: MediaListener[] = []
    const media = {
      get matches() {
        return matches
      },
      addEventListener: (_type: string, listener: MediaListener) => listeners.push(listener),
      removeEventListener: () => {},
    } as unknown as MediaQueryList
    window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia

    const { result } = renderHook(() => useIsFullscreen())
    expect(result.current).toBe(false)

    matches = true
    act(() => listeners.forEach((listener) => listener()))
    expect(result.current).toBe(true)
  })

  it('卸载后移除 resize 与媒体监听', () => {
    const { listeners } = stubMatchMedia(false)
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useIsFullscreen())
    unmount()

    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(listeners).toHaveLength(0)
  })
})
