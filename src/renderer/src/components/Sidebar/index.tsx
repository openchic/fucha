import type { ArticleSummary } from '@shared/store-types'
import { type MouseEvent, useCallback, useRef, useState } from 'react'
import { useConfirm } from '../../hooks'
import { Icon } from '../Icon'
import { Popover } from '../Popover'

type SidebarProps = {
  items: ArticleSummary[]
  ready: boolean
  error?: string
  activeHash?: string
  onNew: () => void
  onOpen: (item: ArticleSummary) => void
  onDelete: (item: ArticleSummary) => Promise<void>
  onSettings: () => void
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '').trim() ||
    '删除失败，请重试'
  )
}

/** 预览页左侧历史列表：点击打开快照，悬停提供更多操作 */
export const Sidebar = (props: SidebarProps) => {
  const { items, ready, error, activeHash, onNew, onOpen, onDelete, onSettings } = props
  const confirm = useConfirm()
  const [menuTarget, setMenuTarget] = useState<ArticleSummary | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuError, setMenuError] = useState('')
  const anchorRef = useRef<HTMLButtonElement>(null)
  const positionRef = useRef<HTMLLIElement>(null)

  const closeMenu = useCallback((): void => {
    setMenuOpen(false)
    setBusy(false)
    setMenuError('')
  }, [])

  const openMenu = (event: MouseEvent<HTMLButtonElement>, item: ArticleSummary): void => {
    if (menuOpen && menuTarget?.hash === item.hash) {
      closeMenu()
      return
    }
    anchorRef.current = event.currentTarget
    positionRef.current = event.currentTarget.closest('li')
    setMenuTarget(item)
    setMenuOpen(true)
    setMenuError('')
  }

  const handleDelete = async (item: ArticleSummary): Promise<void> => {
    closeMenu()
    const confirmed = await confirm({
      title: '确定删除任务？',
      description: `此操作会从本机永久删除「${item.title}」，且无法恢复，请谨慎操作。`,
      confirmLabel: '删除',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusy(true)
    setMenuError('')
    try {
      await onDelete(item)
      closeMenu()
    } catch (cause) {
      setMenuError(readableError(cause))
      setMenuOpen(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside aria-label="最近文章" className="flex h-full w-[248px] flex-none flex-col bg-panel">
      <div className="pt-14 pb-3">
        <div className="px-2">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-body leading-5 text-ink-soft transition-colors hover:bg-raised">
            <Icon name="plus" className="h-3.5 w-3.5 flex-none" />
            新建
          </button>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-2 px-4">
          <h2 className="text-title text-ink">最近</h2>
          {items.length > 0 && (
            <span className="text-description text-ink-soft">
              {items.length >= 50 ? '50+' : items.length} 篇
            </span>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="最近文章">
        {!ready && <p className="px-3 py-6 text-body text-ink-soft">正在读取历史…</p>}
        {ready && error && <p className="px-3 py-6 text-body text-danger">{error}</p>}
        {ready && !error && items.length === 0 && (
          <div className="px-3 py-8 text-center text-body text-ink-soft">
            <p>还没有历史记录</p>
            <p className="mt-1 text-description">提取成功的文章会自动保存在这里</p>
          </div>
        )}
        {ready && !error && items.length > 0 && (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const isActive = item.hash === activeHash
              return (
                <li key={item.hash} className="group relative">
                  <button
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => onOpen(item)}
                    className={`w-full rounded-lg px-3 py-2 pr-12 text-left transition-colors ${
                      isActive
                        ? 'bg-accent-soft text-ink group-hover:bg-accent-hover'
                        : 'text-ink-soft group-hover:bg-raised'
                    }`}>
                    <span className="block truncate text-body leading-5">{item.title}</span>
                  </button>
                  <button
                    type="button"
                    aria-label="更多操作"
                    title="更多操作"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen && menuTarget?.hash === item.hash}
                    onClick={(event) => openMenu(event, item)}
                    className="absolute top-1/2 right-2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-soft opacity-0 transition-colors hover:text-ink group-hover:opacity-100 focus-visible:opacity-100">
                    <Icon name="more" className="h-[18px] w-[18px] flex-none" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>

      <footer className="flex h-12 flex-none items-center px-3">
        <button
          type="button"
          onClick={onSettings}
          aria-label="设置"
          title="设置"
          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink">
          <Icon name="settings" className="h-4 w-4 flex-none" />
        </button>
      </footer>

      {menuTarget && (
        <Popover
          open={menuOpen}
          onOpenChange={(next) => {
            if (!next) closeMenu()
          }}
          anchorRef={anchorRef}
          positionRef={positionRef}
          align="end"
          role="menu"
          ariaLabel="历史操作"
          className="w-32">
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void handleDelete(menuTarget)}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-body text-danger transition-colors hover:bg-raised disabled:opacity-50">
            删除
          </button>
          {menuError && (
            <p role="alert" className="px-2.5 py-1 text-body leading-[1.5] text-danger">
              {menuError}
            </p>
          )}
        </Popover>
      )}
    </aside>
  )
}

Sidebar.displayName = 'Sidebar'
