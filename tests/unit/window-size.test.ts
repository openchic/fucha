import { describe, expect, it } from 'vitest'
import { fitWindowSize } from '../../src/main/window-size'

describe('fitWindowSize', () => {
  it('工作区大于默认值时使用 1200x800', () => {
    expect(fitWindowSize({ width: 1920, height: 1080 })).toEqual({ width: 1200, height: 800 })
  })

  it('工作区恰好等于默认值时不变', () => {
    expect(fitWindowSize({ width: 1200, height: 800 })).toEqual({ width: 1200, height: 800 })
  })

  it('宽度不足时只收窄宽度', () => {
    expect(fitWindowSize({ width: 1000, height: 900 })).toEqual({ width: 1000, height: 800 })
  })

  it('高度不足时只压低高度', () => {
    expect(fitWindowSize({ width: 1600, height: 700 })).toEqual({ width: 1200, height: 700 })
  })

  it('宽高都不足时同时收窄', () => {
    expect(fitWindowSize({ width: 800, height: 600 })).toEqual({ width: 800, height: 600 })
  })

  it('极小的辅助屏也按工作区返回', () => {
    expect(fitWindowSize({ width: 320, height: 240 })).toEqual({ width: 320, height: 240 })
  })

  it('结果永不超过工作区', () => {
    const areas = [
      { width: 0, height: 0 },
      { width: 100, height: 100 },
      { width: 1199, height: 799 },
      { width: 1201, height: 801 },
      { width: 5120, height: 2880 },
    ]
    for (const area of areas) {
      const size = fitWindowSize(area)
      expect(size.width).toBeLessThanOrEqual(area.width)
      expect(size.height).toBeLessThanOrEqual(area.height)
    }
  })

  it('不修改传入的工作区对象', () => {
    const area = { width: 1920, height: 1080 }
    fitWindowSize(area)
    expect(area).toEqual({ width: 1920, height: 1080 })
  })
})
