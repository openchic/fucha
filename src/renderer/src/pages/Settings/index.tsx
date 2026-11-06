import { useCallback, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Icon } from '../../components'
import { useThemeLibrary } from '../../hooks'

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
    <div className="flex h-full overflow-hidden bg-panel">
      <aside className="flex w-[264px] flex-none flex-col bg-panel pt-14">
        <div className="px-2">
          <button
            type="button"
            onClick={goBack}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-body text-ink-soft transition-colors hover:bg-white hover:text-ink">
            <Icon name="arrow-left" className="h-3.5 w-3.5 flex-none" />
            返回
          </button>
        </div>
        <nav className="mt-4 px-2" aria-label="设置">
          <button
            type="button"
            onClick={goThemes}
            aria-current={themesActive ? 'page' : undefined}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body transition-colors ${
              themesActive ? 'bg-white text-ink' : 'text-ink-soft hover:bg-white hover:text-ink'
            }`}>
            <Icon name="settings" className="h-3.5 w-3.5 flex-none" />
            主题管理
          </button>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col bg-panel py-2 pr-2">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(29,29,31,0.05)]">
          <Outlet
            context={{
              themes: library.themes,
              ready: library.ready,
              refresh: library.refresh,
              registerLeaveGuard,
            }}
          />
        </div>
      </div>
    </div>
  )
}

Settings.displayName = 'Settings'

export default Settings
