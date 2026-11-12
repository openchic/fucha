import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom 不实现 SubtleCrypto，用 Node 的 webcrypto 补齐抓取管线依赖的摘要能力
if (!window.crypto?.subtle) {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
}

// jsdom 不实现 ResizeObserver，预览组件用它跟随容器尺寸
class ResizeObserverStub {
  observe(): void {
    /* 断言不依赖真实布局 */
  }
  unobserve(): void {
    /* 断言不依赖真实布局 */
  }
  disconnect(): void {
    /* 断言不依赖真实布局 */
  }
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    value: ResizeObserverStub,
    configurable: true,
  })
}

afterEach(() => {
  cleanup()
})
