import type { AvailableTheme } from '../../../theme/library'
import type { CSSProperties } from 'react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Icon, Popover } from '../../../components'
import { useConfirm } from '../../../hooks'
import { themeErrorMessage } from '../../../theme/library'
import { useSettingsContext } from '../context'

/** 暂时隐藏新建主题与主题包入口；恢复时改回 true */
const SHOW_THEME_AUTHORING_ACTIONS = false

type RowMenuProps = {
  onSaveAs: () => void
  onExport: () => void
  onDelete: () => void
}

const RowMenu = (props: RowMenuProps) => {
  const { onSaveAs, onExport, onDelete } = props
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const run = (action: () => void): void => {
    setOpen(false)
    action()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="更多操作"
        title="更多操作"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink">
        <Icon name="more" className="h-[18px] w-[18px] flex-none" />
      </button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchorRef={triggerRef}
        align="end"
        role="menu"
        ariaLabel="主题操作"
        className="w-32">
        <button
          type="button"
          role="menuitem"
          onClick={() => run(onSaveAs)}
          className="w-full rounded-lg px-2.5 py-1.5 text-left text-body text-ink-soft transition-colors hover:bg-raised hover:text-ink">
          另存为
        </button>
        {SHOW_THEME_AUTHORING_ACTIONS && (
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onExport)}
            className="w-full rounded-lg px-2.5 py-1.5 text-left text-body text-ink-soft transition-colors hover:bg-raised hover:text-ink">
            导出
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => run(onDelete)}
          className="w-full rounded-lg px-2.5 py-1.5 text-left text-body text-danger transition-colors hover:bg-raised">
          删除
        </button>
      </Popover>
    </>
  )
}

/** 主题缩略样本：用主题自己的纸色、标题装饰、正文色与引用边条表达版式 */
const ThemeSpecimen = ({ theme }: { theme: AvailableTheme }) => {
  const { token } = theme
  const titleStyle: CSSProperties = {
    backgroundColor: token.headingColor,
    ...(token.h1.decoration === 'bar'
      ? { borderLeft: `2px solid ${token.primary}`, paddingLeft: 3 }
      : token.h1.decoration === 'underline'
        ? { borderBottom: `2px solid ${token.primary}` }
        : token.h1.decoration === 'bracket'
          ? { borderLeft: `2px solid ${token.primary}`, borderRight: `2px solid ${token.primary}` }
          : {}),
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-[60px] w-[88px] flex-none flex-col justify-between overflow-hidden p-2.5"
      style={{
        backgroundColor: token.quote.backgroundColor,
        border: `1px solid ${token.borderColor}`,
        borderRadius: Math.min(token.quote.borderRadius, 8),
      }}>
      <span
        className={`block h-[3px] w-8 ${token.h1.textAlign === 'center' ? 'self-center' : ''}`}
        style={titleStyle}
      />
      <span className="flex flex-col gap-[3px]">
        <span
          className="block h-[2px] w-full opacity-[0.2]"
          style={{ backgroundColor: token.text.color }}
        />
        <span
          className="block h-[2px] w-4/5 opacity-[0.15]"
          style={{ backgroundColor: token.text.color }}
        />
        <span
          className="block h-[2px] w-3/5 opacity-[0.1]"
          style={{ backgroundColor: token.text.color }}
        />
      </span>
      <span className="flex items-center gap-1">
        <span
          className="block h-2.5 w-[2px] flex-none"
          style={{ backgroundColor: token.primary }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span
            className="block h-[2px] w-3/4 opacity-[0.4]"
            style={{ backgroundColor: token.text.color }}
          />
          <span
            className="block h-[2px] w-1/2 opacity-[0.25]"
            style={{ backgroundColor: token.text.color }}
          />
        </span>
      </span>
    </div>
  )
}

/** Settings 主题列表：内置只读，自定义可编辑、导出与删除 */
const ThemeList = () => {
  const { themes, ready, refresh } = useSettingsContext()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const builtins = themes.filter((theme) => theme.builtin)
  const customs = themes.filter((theme) => !theme.builtin)

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
    } catch (cause) {
      setError(themeErrorMessage(cause, '操作失败'))
    } finally {
      setBusy(false)
    }
  }

  const handleImport = (): void => {
    void run(async () => {
      const result = await window.fucha.importThemePackage()
      if (!result.ok) {
        if (!result.canceled) setError(result.error ?? '导入失败')
        return
      }
      refresh()
      setNotice(`已导入「${result.theme.name}」`)
    })
  }

  const handleExport = (theme: AvailableTheme): void => {
    void run(async () => {
      const result = await window.fucha.exportThemePackage({
        token: { ...theme.token, name: theme.name },
        css: theme.css,
      })
      if (!result.ok) {
        if (!result.canceled) setError(result.error ?? '导出失败')
        return
      }
      setNotice(`已导出到 ${result.path}`)
    })
  }

  const handleDelete = async (theme: AvailableTheme): Promise<void> => {
    const confirmed = await confirm({
      title: '删除主题？',
      description: `「${theme.name}」将被永久删除。`,
      confirmLabel: '删除',
      tone: 'danger',
    })
    if (!confirmed) return
    void run(async () => {
      await window.fucha.deleteTheme(theme.id)
      refresh()
    })
  }

  const openNew = (): void => {
    navigate('/settings/themes/new')
  }

  const openCopy = (theme: AvailableTheme): void => {
    navigate(`/settings/themes/new?from=${encodeURIComponent(theme.id)}`)
  }

  const openEdit = (theme: AvailableTheme): void => {
    navigate(`/settings/themes/${encodeURIComponent(theme.id)}`)
  }

  const renderActions = (theme: AvailableTheme) => {
    if (theme.builtin) {
      return (
        <div className="flex flex-none items-center gap-1">
          <Button
            variant="secondary"
            onClick={() => openCopy(theme)}
            disabled={busy}
            className="h-7 px-3">
            另存为
          </Button>
        </div>
      )
    }
    return (
      <div className="flex flex-none items-center gap-1">
        <Button
          variant="secondary"
          onClick={() => openEdit(theme)}
          disabled={busy}
          className="h-7 px-3">
          编辑
        </Button>
        <RowMenu
          onSaveAs={() => openCopy(theme)}
          onExport={() => handleExport(theme)}
          onDelete={() => void handleDelete(theme)}
        />
      </div>
    )
  }

  const renderRow = (theme: AvailableTheme) => (
    <li key={theme.id} className="flex items-center gap-3.5 py-3">
      <ThemeSpecimen theme={theme} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-ink">{theme.name}</p>
        {theme.builtin && (
          <p className="mt-0.5 truncate text-description text-ink-soft">内置 · 只读</p>
        )}
      </div>
      {renderActions(theme)}
    </li>
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <header className="flex flex-none">
        <div className="content-column flex max-w-[47.5rem] items-start justify-between gap-6 pt-10 pb-3">
          <div className="min-w-0">
            <h1 className="text-xl text-ink">主题管理</h1>
            <p className="mt-1 text-description leading-[1.6] text-ink-soft">
              内置主题只读；自定义主题保存后，改动会同步到所有使用该主题的文章。
            </p>
          </div>
          {SHOW_THEME_AUTHORING_ACTIONS && (
            <div className="flex flex-none items-center gap-2">
              <Button variant="primary" onClick={openNew} disabled={busy} className="h-7 px-3">
                新建主题
              </Button>
              <Button
                variant="secondary"
                onClick={handleImport}
                disabled={busy}
                className="h-7 px-3">
                导入主题包
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="content-column max-w-[47.5rem] pt-4 pb-6">
          {!ready ? (
            <p className="mt-4 text-body text-ink-soft">正在读取主题…</p>
          ) : (
            <>
              <section>
                <h2 className="mb-3 text-title text-ink">内置主题</h2>
                <ul className="divide-y divide-line">{builtins.map(renderRow)}</ul>
              </section>

              <section className="mt-8">
                <h2 className="mb-3 text-title text-ink">自定义主题</h2>
                {customs.length === 0 ? (
                  <div className="flex h-14 items-center justify-between gap-4 rounded-lg border border-dashed border-line px-4">
                    <p className="min-w-0 text-body text-ink-soft">
                      还没有自定义主题，通过内置主题的「另存为」新建主题。
                    </p>
                    {SHOW_THEME_AUTHORING_ACTIONS && (
                      <button
                        type="button"
                        onClick={openNew}
                        className="flex-none text-body text-primary transition-colors hover:underline">
                        新建主题
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="divide-y divide-line">{customs.map(renderRow)}</ul>
                )}
              </section>
            </>
          )}

          <div className="mt-4 min-h-[20px] text-body" role="status">
            {error ? <span className="text-danger">{error}</span> : <span>{notice}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

ThemeList.displayName = 'ThemeList'

export default ThemeList
