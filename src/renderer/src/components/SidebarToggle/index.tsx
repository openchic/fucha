import { Icon } from '../Icon'
import { Tooltip } from '../Tooltip'

type SidebarToggleProps = {
  collapsed: boolean
  onToggle: () => void
  fullscreen?: boolean
}

/** 交通灯右侧的侧栏开关，Home 与设置页共用同一位置和提示 */
export const SidebarToggle = ({ collapsed, onToggle, fullscreen }: SidebarToggleProps) => (
  <div className={`no-drag absolute top-[16px] z-40 ${fullscreen ? 'left-[12px]' : 'left-[84px]'}`}>
    <Tooltip label={collapsed ? '展开左侧栏' : '收起左侧栏'} shortcut="⌘B">
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
        aria-expanded={!collapsed}
        className="no-drag flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-ink focus-visible:bg-white focus-visible:text-ink">
        <Icon
          name={collapsed ? 'sidebar-expand' : 'sidebar-collapse'}
          className="pointer-events-none h-3.5 w-3.5 flex-none translate-y-[1px]"
        />
      </button>
    </Tooltip>
  </div>
)

SidebarToggle.displayName = 'SidebarToggle'
