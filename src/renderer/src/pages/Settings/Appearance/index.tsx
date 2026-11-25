import { type FC, useState } from 'react'
import { useAppearance, type AppearanceMode } from '../../../hooks'

const OPTIONS: {
  mode: AppearanceMode
  label: string
}[] = [
  {
    mode: 'system',
    label: '跟随系统',
  },
  {
    mode: 'light',
    label: '浅色',
  },
  {
    mode: 'dark',
    label: '深色',
  },
]

const Appearance: FC = () => {
  const { mode, setMode } = useAppearance()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectMode = async (nextMode: AppearanceMode): Promise<void> => {
    if (nextMode === mode || saving) return
    setSaving(true)
    setError('')
    try {
      await setMode(nextMode)
    } catch {
      setError('保存外观设置失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      <header className="flex-none">
        <div className="content-column max-w-[47.5rem] pt-10">
          <h1 className="text-xl text-ink">外观</h1>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="content-column max-w-[47.5rem] pt-4 pb-6">
          <fieldset disabled={saving} className="m-0 border-0 p-0">
            <legend className="mb-4 text-title text-ink">视觉模式</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {OPTIONS.map((option) => {
                const selected = mode === option.mode
                return (
                  <label
                    key={option.mode}
                    className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 transition-colors ${
                      selected ? 'border-accent bg-accent-soft' : 'border-line hover:bg-raised'
                    } ${saving ? 'cursor-wait opacity-70' : ''}`}>
                    <input
                      type="radio"
                      name="appearance-mode"
                      value={option.mode}
                      checked={selected}
                      onChange={() => void selectMode(option.mode)}
                      className="h-4 w-4 flex-none accent-accent"
                    />
                    <span className="min-w-0 text-body text-ink">{option.label}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {saving && (
            <p role="status" className="mt-3 text-description text-ink-soft">
              正在保存…
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-description text-danger">
              {error}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

Appearance.displayName = 'Appearance'

export default Appearance
