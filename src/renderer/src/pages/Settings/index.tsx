import type { AvailableTheme } from '../../theme/library'
import { createContext, useCallback, useContext, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Icon } from '../../components'
import { useThemeLibrary } from '../../hooks'

type SettingsContextValue = {
  themes: AvailableTheme[]
  ready: boolean
  refresh: () => void
  registerLeaveGuard: (guard: (() => Promise<boolean>) | null) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettingsContext(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettingsContext 必须在 Settings 布局内使用')
  return context
}

/** Settings 布局：左侧设置导航，右侧承载主题列表与配置页 */
const Settings = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const library = useThemeLibrary()
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null)
  const returnTo = useRef((location.state as { returnTo?: string } | null)?.returnTo ?? '/')

  const registerLeaveGuard = useCallback((guard: (() => Promise<boolean>) | null): void => {
    leaveGuard.current = guard
  }, [])

  const leave = async (target: () => void): Promise<void> => {
    if (leaveGuard.current && !(await leaveGuard.current())) return
    target()
  }

  const goBack = (): void => {
    void leave(() => navigate(returnTo.current))
  }

  const goThemes = (): void => {
    void leave(() => navigate('/settings/themes'))
  }

  const themesActive = location.pathname.startsWith('/settings/themes')

  return (
    <div className="flex h-full overflow-hidden bg-white">
      <aside className="flex w-[264px] flex-none flex-col border-r border-line bg-white pt-14">
        <div className="px-2">
          <button
            type="button"
            onClick={goBack}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-secondary font-medium text-ink-soft transition-colors hover:bg-raised hover:text-ink">
            <Icon name="arrow-left" className="h-3.5 w-3.5 flex-none" />
            返回
          </button>
        </div>
        <nav className="mt-4 px-2" aria-label="设置">
          <button
            type="button"
            onClick={goThemes}
            aria-current={themesActive ? 'page' : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-secondary transition-colors ${
              themesActive ? 'bg-raised text-ink' : 'text-ink-soft hover:bg-raised hover:text-ink'
            }`}>
            <Icon name="settings" className="h-3.5 w-3.5 flex-none" />
            主题管理
          </button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <SettingsContext.Provider
          value={{
            themes: library.themes,
            ready: library.ready,
            refresh: library.refresh,
            registerLeaveGuard,
          }}>
          <Outlet />
        </SettingsContext.Provider>
      </div>
    </div>
  )
}

Settings.displayName = 'Settings'

export default Settings
