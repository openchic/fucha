import type { FuchaApi } from '@shared/types'

declare global {
  interface Window {
    fucha: FuchaApi
  }
}
