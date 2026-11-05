import type { ThemeToken } from '@shared/types'
import type { AvailableTheme } from '../../../theme/library'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Icon, ThemePanel } from '../../../components'
import { useConfirm, type ConfirmOptions } from '../../../hooks'
import { buildPreviewStyle, previewStyleVariables } from '../../../theme/apply'
import { DEFAULT_AVAILABLE_THEME, themeErrorMessage } from '../../../theme/library'
import { useSettingsContext } from '../context'
import { SamplePreview } from './SamplePreview'

type EditorMode = 'edit' | 'copy' | 'new'

const DISCARD_PROMPT: ConfirmOptions = {
  title: '放弃未保存的主题调整？',
  description: '修改尚未保存，继续将丢失这些调整。',
  confirmLabel: '放弃',
  tone: 'danger',
}

function initialDraft(source: AvailableTheme, mode: EditorMode): AvailableTheme {
  if (mode === 'edit') {
    return { ...source, token: structuredClone(source.token) }
  }
  if (mode === 'copy') {
    const name = `${source.name} 副本`
    return {
      ...source,
      id: 'new-theme',
      name,
      builtin: false,
      sourceThemeId: source.id,
      token: { ...structuredClone(source.token), id: 'new-theme', name, builtin: false },
    }
  }
  const name = '新主题'
  return {
    ...DEFAULT_AVAILABLE_THEME,
    id: 'new-theme',
    name,
    builtin: false,
    sourceThemeId: undefined,
    token: {
      ...structuredClone(DEFAULT_AVAILABLE_THEME.token),
      id: 'new-theme',
      name,
      builtin: false,
    },
  }
}

type ThemeEditorProps = {
  source: AvailableTheme
  mode: EditorMode
  refresh: () => void
  registerLeaveGuard: (guard: (() => Promise<boolean>) | null) => void
}

const ThemeEditor = (props: ThemeEditorProps) => {
  const { source, mode, refresh, registerLeaveGuard } = props
  const navigate = useNavigate()
  const confirm = useConfirm()
  const nameInputId = useId()
  const sourceName = mode === 'new' ? '完全自定义' : source.name
  const creating = mode !== 'edit'
  const [draft, setDraft] = useState<AvailableTheme>(() => initialDraft(source, mode))
  const [baseline] = useState<ThemeToken>(() => structuredClone(draft.token))
  const [name, setName] = useState(sourceName === '完全自定义' ? '新主题' : `${sourceName} 副本`)
  const [saving, setSaving] = useState(false)
  const [savingCurrent, setSavingCurrent] = useState(false)
  const [primaryError, setPrimaryError] = useState('')
  const dirty = JSON.stringify(draft.token) !== JSON.stringify(baseline)
  const title = creating ? (sourceName === '完全自定义' ? '新建主题' : '另存为新主题') : '编辑主题'
  const metaLabel = dirty ? '未保存' : ''
  const previewStyle = useMemo(() => buildPreviewStyle(draft), [draft])
  const previewVariables = useMemo(() => previewStyleVariables(draft.token), [draft.token])

  const confirmLeave = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    return confirm(DISCARD_PROMPT)
  }, [confirm, dirty])

  useEffect(() => {
    registerLeaveGuard(confirmLeave)
    return () => registerLeaveGuard(null)
  }, [confirmLeave, registerLeaveGuard])

  const leaveToList = (): void => {
    void (async () => {
      if (!(await confirmLeave())) return
      navigate('/settings/themes')
    })()
  }

  const save = async (): Promise<string | null> => {
    if (mode !== 'edit') return '请使用创建主题'
    try {
      await window.fucha.updateTheme({
        id: source.id,
        token: draft.token,
        css: draft.css,
      })
      refresh()
      navigate('/settings/themes')
      return null
    } catch (error) {
      return themeErrorMessage(error, '保存主题失败')
    }
  }

  const create = async (rawName: string): Promise<string | null> => {
    const themeName = rawName.trim()
    if (!themeName) return '请输入主题名称'
    const token: ThemeToken = {
      ...structuredClone(draft.token),
      id: `custom-${crypto.randomUUID()}`,
      name: themeName,
      builtin: false,
    }
    try {
      await window.fucha.createTheme({
        token,
        css: draft.css,
        sourceThemeId: mode === 'new' ? undefined : source.id,
      })
      refresh()
      navigate('/settings/themes')
      return null
    } catch (error) {
      return themeErrorMessage(error, '保存主题失败')
    }
  }

  const handlePrimary = async (): Promise<void> => {
    setPrimaryError('')
    if (creating) {
      setSaving(true)
      const message = await create(name)
      setSaving(false)
      if (message) setPrimaryError(message)
      return
    }
    setSavingCurrent(true)
    const message = await save()
    setSavingCurrent(false)
    if (message) setPrimaryError(message)
  }

  const changeName = (value: string): void => {
    setPrimaryError('')
    if (creating) {
      setName(value)
      return
    }
    setDraft((current) => ({
      ...current,
      name: value,
      token: { ...current.token, name: value },
    }))
  }

  const header = (
    <div className="flex flex-none flex-col gap-2 px-6 pt-5">
      <div className="flex w-full items-center gap-1.5 rounded-full border border-line bg-white pl-3 pr-1.5 focus-within:border-primary">
        <input
          id={nameInputId}
          type="text"
          value={creating ? name : draft.token.name}
          onChange={(event) => changeName(event.target.value)}
          aria-label="主题名称"
          title="主题名称"
          placeholder="主题名称"
          autoFocus={creating}
          className="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ink placeholder:text-ink-soft focus-visible:outline-none"
        />
        <label
          htmlFor={nameInputId}
          title="编辑主题名称"
          className="flex h-8 w-6 flex-none cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-ink">
          <Icon name="edit" className="h-3.5 w-3.5 flex-none" />
        </label>
      </div>
    </div>
  )

  const footer = (
    <footer className="flex-none border-t border-line px-6 py-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={leaveToList} className="h-8">
          取消
        </Button>
        <Button
          variant="primary"
          onClick={() => void handlePrimary()}
          disabled={saving || savingCurrent}
          className="h-8">
          {creating ? (saving ? '创建中' : '创建主题') : savingCurrent ? '保存中' : '保存'}
        </Button>
      </div>
      {primaryError && (
        <p role="alert" className="mt-2 text-description text-danger">
          {primaryError}
        </p>
      )}
    </footer>
  )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="drag-region relative z-30 flex h-11 flex-none items-center gap-2 border-b border-line px-6">
        <Button
          variant="back"
          onClick={leaveToList}
          aria-label="返回主题管理"
          title="返回主题管理"
          className="no-drag ml-0 h-8 w-8 px-0">
          <Icon name="arrow-left" className="h-4 w-4 flex-none" />
        </Button>
        <h1 className="min-w-0 truncate text-title text-ink">{title}</h1>
        {metaLabel && (
          <span className="ml-auto flex-none text-description text-ink-soft">{metaLabel}</span>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <SamplePreview styleCss={previewStyle} variables={previewVariables} />
        <ThemePanel
          theme={draft}
          baseline={baseline}
          title={title}
          header={header}
          footer={footer}
          onTokenChange={(token) => {
            setDraft((current) => ({ ...current, name: token.name, token }))
            setPrimaryError('')
          }}
        />
      </div>
    </div>
  )
}

ThemeEditor.displayName = 'ThemeEditor'

/** Settings 主题配置路由：编辑自定义主题、从主题另存为或完全自定义新建 */
const ThemeEditorPage = () => {
  const { themes, ready, refresh, registerLeaveGuard } = useSettingsContext()
  const { id } = useParams()
  const [params] = useSearchParams()
  const from = params.get('from')

  if (!ready) {
    return <p className="px-6 py-8 text-body text-ink-soft">正在读取主题…</p>
  }

  if (id) {
    const theme = themes.find((item) => item.id === id)
    if (!theme) return <Navigate to="/settings/themes" replace />
    if (theme.builtin) {
      return <Navigate to={`/settings/themes/new?from=${encodeURIComponent(theme.id)}`} replace />
    }
    return (
      <ThemeEditor
        key={`edit-${theme.id}`}
        source={theme}
        mode="edit"
        refresh={refresh}
        registerLeaveGuard={registerLeaveGuard}
      />
    )
  }

  if (from) {
    const source = themes.find((theme) => theme.id === from)
    if (!source) return <Navigate to="/settings/themes" replace />
    return (
      <ThemeEditor
        key={`copy-${source.id}`}
        source={source}
        mode="copy"
        refresh={refresh}
        registerLeaveGuard={registerLeaveGuard}
      />
    )
  }

  return (
    <ThemeEditor
      key="new"
      source={DEFAULT_AVAILABLE_THEME}
      mode="new"
      refresh={refresh}
      registerLeaveGuard={registerLeaveGuard}
    />
  )
}

ThemeEditorPage.displayName = 'ThemeEditorPage'

export default ThemeEditorPage
