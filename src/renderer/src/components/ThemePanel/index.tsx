import type { HeadingDecoration, HeadingToken, ThemeDefinition, ThemeToken } from '@shared/types'
import { HEADING_KEYS, THEME_RANGES, type HeadingKey, type NumericRange } from '@shared/theme'
import { type FormEvent, useState } from 'react'
import { Button } from '../Button'

type ThemePanelProps = {
  theme: ThemeDefinition
  sourceName: string
  dirty: boolean
  creating: boolean
  canSave: boolean
  onTokenChange: (token: ThemeToken) => void
  onCancel: () => void
  onSave: () => Promise<string | null>
  onSaveAs: (name: string) => Promise<string | null>
}

type NumberControlProps = {
  label: string
  value: number
  range: NumericRange
  unit?: string
  onChange: (value: number) => void
}

const NumberControl = (props: NumberControlProps) => {
  const { label, value, range, unit = '', onChange } = props
  return (
    <label className="flex w-28 flex-none flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2 text-secondary text-ink-soft">
        <span>{label}</span>
        <output className="text-ink">
          {value}
          {unit}
        </output>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-4 w-full cursor-pointer accent-primary"
      />
    </label>
  )
}
NumberControl.displayName = 'NumberControl'

type ColorControlProps = {
  label: string
  value: string
  onChange: (value: string) => void
}

const ColorControl = (props: ColorControlProps) => {
  const { label, value, onChange } = props
  return (
    <label className="flex w-16 flex-none flex-col gap-1 text-secondary text-ink-soft">
      <span className="truncate">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-6 w-8 cursor-pointer rounded border border-line bg-white p-0"
      />
    </label>
  )
}
ColorControl.displayName = 'ColorControl'

type SegmentedProps<T extends string> = {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}

const Segmented = <T extends string>(props: SegmentedProps<T>) => {
  const { label, value, options, onChange } = props
  return (
    <div className="flex flex-col gap-1">
      <span className="text-secondary text-ink-soft">{label}</span>
      <div className="flex rounded-full bg-raised p-0.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`h-6 rounded-full px-2.5 text-xs transition-colors ${
              option.value === value ? 'bg-white text-ink' : 'text-ink-soft hover:text-ink'
            }`}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
Segmented.displayName = 'Segmented'

const ALIGN_OPTIONS = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
] as const

const DECORATION_OPTIONS: { value: HeadingDecoration; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'bar', label: '左条' },
  { value: 'underline', label: '下划线' },
  { value: 'bracket', label: '括号' },
]

const DIVIDER_OPTIONS = [
  { value: 'solid', label: '实线' },
  { value: 'dotted', label: '点线' },
  { value: 'none', label: '无' },
] as const

const TABS = [
  { value: 'colors', label: '颜色' },
  { value: 'text', label: '正文' },
  { value: 'headings', label: '标题' },
  { value: 'components', label: '组件' },
] as const

type PanelTab = (typeof TABS)[number]['value']

/** 编辑或新建主题草稿：只改 token，实时反映到预览 */
export const ThemePanel = (props: ThemePanelProps) => {
  const { theme, sourceName, dirty, creating, canSave, onTokenChange, onCancel, onSave, onSaveAs } =
    props
  const [tab, setTab] = useState<PanelTab>('text')
  const [level, setLevel] = useState<HeadingKey>('h1')
  const [saveOpen, setSaveOpen] = useState(creating)
  const [name, setName] = useState(sourceName === '完全自定义' ? '新主题' : `${sourceName} 副本`)
  const [saving, setSaving] = useState(false)
  const [savingCurrent, setSavingCurrent] = useState(false)
  const [error, setError] = useState('')
  const [currentError, setCurrentError] = useState('')

  const token = theme.token
  const heading = token[level]
  const followsTextColor = heading.color === undefined

  const patch = (partial: Partial<ThemeToken>): void => {
    onTokenChange({ ...token, ...partial })
  }

  const patchText = (partial: Partial<ThemeToken['text']>): void => {
    patch({ text: { ...token.text, ...partial } })
  }

  const patchHeading = (partial: Partial<HeadingToken>): void => {
    const next = { ...token }
    next[level] = { ...next[level], ...partial }
    onTokenChange(next)
  }

  const handleSave = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const message = await onSaveAs(name)
    setSaving(false)
    if (message) setError(message)
  }

  const handleSaveCurrent = async (): Promise<void> => {
    setSavingCurrent(true)
    setCurrentError('')
    const message = await onSave()
    setSavingCurrent(false)
    if (message) setCurrentError(message)
  }

  return (
    <section
      aria-label={
        creating ? (sourceName === '完全自定义' ? '新建主题' : '另存为新主题') : '编辑主题'
      }
      className="relative z-30 flex-none border-b border-line bg-white pt-2 pb-3">
      <div className="content-column">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="flex-none text-title font-semibold text-ink">
                {creating
                  ? sourceName === '完全自定义'
                    ? '新建主题'
                    : '另存为新主题'
                  : '编辑主题'}
              </h1>
              {!creating && (
                <input
                  type="text"
                  value={token.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  aria-label="主题名称"
                  title="主题名称"
                  className="h-7 w-48 flex-none rounded-full border border-line px-3 text-secondary text-ink focus-visible:border-primary focus-visible:outline-none"
                />
              )}
            </div>
            {(creating || dirty) && (
              <p className="mt-0.5 text-secondary text-ink-soft">
                {creating
                  ? sourceName === '完全自定义'
                    ? '完全自定义'
                    : `基于 ${sourceName}`
                  : '未保存'}
              </p>
            )}
          </div>
          <div className="flex flex-none items-center gap-2">
            <Button variant="secondary" onClick={onCancel} className="h-7 px-3">
              取消
            </Button>
            {canSave && (
              <Button
                variant="primary"
                onClick={() => void handleSaveCurrent()}
                disabled={savingCurrent}
                className="h-7 px-3">
                {savingCurrent ? '保存中' : '保存'}
              </Button>
            )}
            {!creating && (
              <Button
                variant={canSave ? 'secondary' : 'primary'}
                onClick={() => setSaveOpen((open) => !open)}
                className="h-7 px-3">
                另存为
              </Button>
            )}
          </div>
        </div>
        {currentError && (
          <p role="alert" className="mt-1 text-secondary text-danger">
            {currentError}
          </p>
        )}

        {saveOpen && (
          <form onSubmit={handleSave} className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError('')
              }}
              aria-label={creating ? '主题名称' : '新主题名称'}
              autoFocus
              className="h-7 w-56 rounded-full border border-line px-3 text-secondary text-ink focus-visible:border-primary focus-visible:outline-none"
            />
            <Button type="submit" variant="primary" disabled={saving} className="h-7 px-3">
              {saving ? '保存中' : creating ? '创建' : '另存为'}
            </Button>
            <span role="status" className="text-secondary text-danger">
              {error}
            </span>
          </form>
        )}

        <div
          className="mt-2 flex rounded-full bg-raised p-0.5"
          role="tablist"
          aria-label="主题设置">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={item.value === tab}
              onClick={() => setTab(item.value)}
              className={`h-6 rounded-full px-3 text-xs transition-colors ${
                item.value === tab ? 'bg-white text-ink' : 'text-ink-soft hover:text-ink'
              }`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-[4.5rem]" role="tabpanel">
          {tab === 'colors' && (
            <div className="flex flex-wrap gap-4" role="group" aria-label="颜色">
              <ColorControl
                label="主色"
                value={token.primary}
                onChange={(value) => patch({ primary: value })}
              />
              <ColorControl
                label="块底色"
                value={token.backgroundColor}
                onChange={(value) => patch({ backgroundColor: value })}
              />
              <ColorControl
                label="边框"
                value={token.borderColor}
                onChange={(value) => patch({ borderColor: value })}
              />
              <ColorControl
                label="正文"
                value={token.text.color}
                onChange={(value) => patchText({ color: value })}
              />
              <ColorControl
                label="弱化"
                value={token.text.secondaryColor}
                onChange={(value) => patchText({ secondaryColor: value })}
              />
            </div>
          )}

          {tab === 'text' && (
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="正文">
              <NumberControl
                label="字号"
                value={token.text.fontSize}
                range={THEME_RANGES.fontSize}
                unit="px"
                onChange={(value) => patchText({ fontSize: value })}
              />
              <NumberControl
                label="次级字号"
                value={token.text.secondaryFontSize}
                range={THEME_RANGES.secondaryFontSize}
                unit="px"
                onChange={(value) => patchText({ secondaryFontSize: value })}
              />
              <NumberControl
                label="行高"
                value={token.text.lineHeight}
                range={THEME_RANGES.lineHeight}
                onChange={(value) => patchText({ lineHeight: value })}
              />
              <NumberControl
                label="字距"
                value={token.text.letterSpacing}
                range={THEME_RANGES.letterSpacing}
                unit="em"
                onChange={(value) => patchText({ letterSpacing: value })}
              />
              <NumberControl
                label="段后距"
                value={token.text.marginBottom}
                range={THEME_RANGES.marginBottom}
                unit="px"
                onChange={(value) => patchText({ marginBottom: value })}
              />
            </div>
          )}

          {tab === 'headings' && (
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="标题">
              <div className="flex w-40 flex-none flex-col gap-2">
                <div
                  className="flex rounded-full bg-raised p-0.5"
                  role="group"
                  aria-label="标题层级">
                  {HEADING_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={key === level}
                      onClick={() => setLevel(key)}
                      className={`h-6 flex-1 rounded-full text-xs uppercase transition-colors ${
                        key === level ? 'bg-white text-ink' : 'text-ink-soft hover:text-ink'
                      }`}>
                      {key}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 text-secondary text-ink-soft">
                  <input
                    type="checkbox"
                    checked={followsTextColor}
                    onChange={(event) =>
                      patchHeading({
                        color: event.target.checked ? undefined : token.text.color,
                      })
                    }
                    className="accent-primary"
                  />
                  跟随正文色
                </label>
                {!followsTextColor && (
                  <ColorControl
                    label="标题色"
                    value={heading.color ?? token.text.color}
                    onChange={(value) => patchHeading({ color: value })}
                  />
                )}
              </div>
              <NumberControl
                label="字号"
                value={heading.fontSize}
                range={THEME_RANGES[`${level}FontSize`]}
                unit="px"
                onChange={(value) => patchHeading({ fontSize: value })}
              />
              <NumberControl
                label="上边距"
                value={heading.marginTop}
                range={THEME_RANGES.headingMarginTop}
                unit="px"
                onChange={(value) => patchHeading({ marginTop: value })}
              />
              <NumberControl
                label="下边距"
                value={heading.marginBottom}
                range={THEME_RANGES.headingMarginBottom}
                unit="px"
                onChange={(value) => patchHeading({ marginBottom: value })}
              />
              <Segmented
                label="对齐"
                value={heading.textAlign}
                options={[...ALIGN_OPTIONS]}
                onChange={(value) => patchHeading({ textAlign: value })}
              />
              <Segmented
                label="装饰"
                value={heading.decoration}
                options={DECORATION_OPTIONS}
                onChange={(value) => patchHeading({ decoration: value })}
              />
            </div>
          )}

          {tab === 'components' && (
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="组件">
              <NumberControl
                label="引用内距"
                value={token.quote.padding}
                range={THEME_RANGES.quotePadding}
                unit="px"
                onChange={(value) => patch({ quote: { ...token.quote, padding: value } })}
              />
              <NumberControl
                label="代码内距"
                value={token.code.padding}
                range={THEME_RANGES.codePadding}
                unit="px"
                onChange={(value) => patch({ code: { ...token.code, padding: value } })}
              />
              <NumberControl
                label="代码行高"
                value={token.code.lineHeight}
                range={THEME_RANGES.codeLineHeight}
                onChange={(value) => patch({ code: { ...token.code, lineHeight: value } })}
              />
              <NumberControl
                label="表格内距"
                value={token.table.padding}
                range={THEME_RANGES.tablePadding}
                unit="px"
                onChange={(value) => patch({ table: { padding: value } })}
              />
              <NumberControl
                label="图上距"
                value={token.image.marginTop}
                range={THEME_RANGES.imageMarginTop}
                unit="px"
                onChange={(value) => patch({ image: { ...token.image, marginTop: value } })}
              />
              <NumberControl
                label="图下距"
                value={token.image.marginBottom}
                range={THEME_RANGES.imageMarginBottom}
                unit="px"
                onChange={(value) => patch({ image: { ...token.image, marginBottom: value } })}
              />
              <NumberControl
                label="圆角"
                value={token.borderRadius}
                range={THEME_RANGES.borderRadius}
                unit="px"
                onChange={(value) => patch({ borderRadius: value })}
              />
              <Segmented
                label="分割线"
                value={token.divider.borderTopStyle}
                options={[...DIVIDER_OPTIONS]}
                onChange={(value) => patch({ divider: { borderTopStyle: value } })}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

ThemePanel.displayName = 'ThemePanel'
