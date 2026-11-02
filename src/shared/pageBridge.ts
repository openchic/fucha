import { createContext, useContext } from 'react'

export type PageBridge = {
  activeHash?: string
}

export type PageBridgeApi = {
  setPage: (page: PageBridge | null) => void
  refreshHistory: () => void
}

export const PageBridgeContext = createContext<PageBridgeApi | null>(null)

export function usePageBridge(): PageBridgeApi {
  const bridge = useContext(PageBridgeContext)
  if (!bridge) throw new Error('usePageBridge 必须在 Home 布局内使用')
  return bridge
}
