import { type FormEvent, useEffect, useState } from 'react'
import { useConfirm } from '../../hooks'
import { themeErrorMessage, type AvailableTheme } from '../../theme/library'

type ThemeManagerProps = {
  themes: AvailableTheme[]
  activeThemeId: string
  onClose: () => void
  onChanged: () => void
  onApply: (id: string) => void
}

function sourceName(themes: AvailableTheme[], id?: string): string {
  if (!id) return '无来源'
  return themes.find((theme) => theme.id === id)?.name ?? id
}

/** 自定义主题管理：导入、导出、重命名与删除；内置主题不在这里出现 */
export const ThemeManager = (props: ThemeManagerProps) => {
  const { themes, activeThemeId, onClose, onChanged, onApply } = props
  const confirm = useConfirm()
  const customThemes = themes.filter((theme) => !theme.builtin)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
      onChanged()
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
      onChanged()
      setNotice(`已删除「${theme.name}」`)
    })
  }

  const startRename = (theme: AvailableTheme): void => {
    setRenamingId(theme.id)
    setRenameValue(theme.name)
    setError('')
    setNotice('')
  }

  const handleRename = (event: FormEvent): void => {
    event.preventDefault()
    if (!renamingId) return
    const id = renamingId
    const name = renameValue.trim()
    void run(async () => {
      const record = await window.fucha.renameTheme(id, name)
      setRenamingId(null)
      onChanged()
      setNotice(`已重命名为「${record.name}」`)
    })
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/20 p-6"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-manager-title"
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="theme-manager-title" className="text-title font-semibold text-ink">
              自定义主题
            </h2>
            <p className="mt-0.5 text-secondary text-ink-soft">
              内置主题只读；调整后会另存为新的自定义主题。
            </p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={busy}
              className="button button-secondary h-7 px-3">
              导入主题包
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="button button-secondary h-7 px-3">
              关闭
            </button>
          </div>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {customThemes.length === 0 ? (
            <p className="rounded-xl bg-raised px-4 py-6 text-center text-secondary text-ink-soft">
              还没有自定义主题。在主题下拉里选择「编辑当前主题」，调整后另存为即可。
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {customThemes.map((theme) => (
                <li key={theme.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    {renamingId === theme.id ? (
                      <form onSubmit={handleRename} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(event) => setRenameValue(event.target.value)}
                          aria-label="主题名称"
                          autoFocus
                          className="h-7 w-56 rounded-full border border-line px-3 text-secondary text-ink focus-visible:border-primary focus-visible:outline-none"
                        />
                        <button type="submit" className="button button-primary h-7 px-3">
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="button button-secondary h-7 px-3">
                          取消
                        </button>
                      </form>
                    ) : (
                      <>
                        <p className="truncate text-secondary text-ink">
                          {theme.name}
                          {theme.id === activeThemeId ? ' · 当前' : ''}
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          来源：{sourceName(themes, theme.sourceThemeId)} · {theme.id}
                        </p>
                      </>
                    )}
                  </div>
                  {renamingId !== theme.id && (
                    <div className="flex flex-none items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onApply(theme.id)}
                        disabled={busy}
                        className="button button-secondary h-6 px-2.5 text-xs">
                        应用
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExport(theme)}
                        disabled={busy}
                        className="button button-secondary h-6 px-2.5 text-xs">
                        导出
                      </button>
                      <button
                        type="button"
                        onClick={() => startRename(theme)}
                        disabled={busy}
                        className="button button-secondary h-6 px-2.5 text-xs">
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(theme)}
                        disabled={busy}
                        className="button button-secondary h-6 px-2.5 text-xs text-danger">
                        删除
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 min-h-[20px] text-secondary" role="status">
          {error ? <span className="text-danger">{error}</span> : <span>{notice}</span>}
        </div>
      </section>
    </div>
  )
}

ThemeManager.displayName = 'ThemeManager'
