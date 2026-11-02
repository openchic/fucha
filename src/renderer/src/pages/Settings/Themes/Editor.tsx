import type { ThemeToken } from '@shared/types'
import type { AvailableTheme } from '../../../theme/library'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button, Icon, ThemePanel } from '../../../components'
import { useConfirm, type ConfirmOptions } from '../../../hooks'
import { buildPreviewCss } from '../../../theme/apply'
import { DEFAULT_AVAILABLE_THEME, themeErrorMessage } from '../../../theme/library'
import { useSettingsContext } from '..'
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
  const [draft, setDraft] = useState<AvailableTheme>(() => initialDraft(source, mode))
  const [baseline] = useState<ThemeToken>(() => structuredClone(draft.token))
  const dirty = JSON.stringify(draft.token) !== JSON.stringify(baseline)
  const creating = mode !== 'edit'
  const canSave = mode === 'edit'
  const sourceName = mode === 'new' ? '完全自定义' : source.name
  const previewCss = useMemo(() => buildPreviewCss(draft), [draft])

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
    const name = rawName.trim()
    if (!name) return '请输入主题名称'
    const token: ThemeToken = {
      ...structuredClone(draft.token),
      id: `custom-${crypto.randomUUID()}`,
      name,
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

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="drag-region relative z-30 flex h-11 flex-none items-center border-b border-line px-6">
        <Button variant="back" onClick={leaveToList} className="no-drag h-8">
          <Icon name="arrow-left" className="h-4 w-4 flex-none" />
          主题管理
        </Button>
      </div>
      <div className="flex min-h-0 flex-1">
        <SamplePreview css={previewCss} />
        <div className="min-w-0 flex-1 overflow-y-auto">
          <ThemePanel
            theme={draft}
            sourceName={sourceName}
            dirty={dirty}
            creating={creating}
            canSave={canSave}
            onTokenChange={(token) =>
              setDraft((current) => ({ ...current, name: token.name, token }))
            }
            onCancel={leaveToList}
            onSave={save}
            onSaveAs={create}
          />
        </div>
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
    return <p className="px-6 py-8 text-secondary text-ink-soft">正在读取主题…</p>
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
