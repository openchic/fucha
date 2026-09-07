import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BUILTIN_AVAILABLE } from '@renderer/theme/library'
import { useThemeLibrary } from '@renderer/hooks/useThemeLibrary'
import { BUILTIN_THEMES } from '@renderer/theme/presets'
import { installFakeApi, stubThemeRecord } from '../../setup/fake-api'

describe('useThemeLibrary', () => {
  it('返回内置主题，ready 后合并自定义主题', async () => {
    const token = { ...BUILTIN_THEMES[0]!.token, id: 'custom', name: '自定义', builtin: false }
    installFakeApi({
      listThemes: async () => [
        { ...stubThemeRecord(token, 'h1 { color: red; }'), sort: 1, sourceThemeId: 'default' },
      ],
    })
    const { result } = renderHook(() => useThemeLibrary())

    expect(result.current.ready).toBe(false)
    await waitFor(() => expect(result.current.ready).toBe(true))

    const ids = result.current.themes.map((theme) => theme.id)
    expect(ids.slice(0, BUILTIN_AVAILABLE.length)).toEqual(
      BUILTIN_AVAILABLE.map((theme) => theme.id)
    )
    expect(ids).toContain('custom')
    const custom = result.current.themes.find((theme) => theme.id === 'custom')
    expect(custom?.builtin).toBe(false)
    expect(custom?.sourceThemeId).toBe('default')
    expect(custom?.css).toBe('h1 { color: red; }')
    expect(result.current.error).toBeUndefined()
  })

  it('存储不可用时只返回内置主题并给出错误', async () => {
    installFakeApi({
      listThemes: async () => {
        throw new Error('db down')
      },
    })
    const { result } = renderHook(() => useThemeLibrary())

    await waitFor(() => expect(result.current.ready).toBe(true))
    expect(result.current.themes).toEqual(BUILTIN_AVAILABLE)
    expect(result.current.error).toBe('本地主题存储不可用')
  })

  it('refresh 重新拉取主题', async () => {
    const api = installFakeApi({ listThemes: async () => [] })
    const { result } = renderHook(() => useThemeLibrary())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.refresh())
    await waitFor(() => expect(api.listThemes).toHaveBeenCalledTimes(2))
  })
})
