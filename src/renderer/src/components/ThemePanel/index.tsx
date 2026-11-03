import type { HeadingDecoration, HeadingToken, ThemeDefinition, ThemeToken } from '@shared/types'
import { HEADING_KEYS, THEME_RANGES, type HeadingKey, type NumericRange } from '@shared/theme'
import { type FormEvent, useId, useRef, useState } from 'react'
import { Sketch } from '@uiw/react-color'
import { Button } from '../Button'
import { Dropdown } from '../Dropdown'
import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { highlightThemeBackground } from '../../theme/highlight'

type ThemePanelProps = {
  theme: ThemeDefinition
  baseline: ThemeToken
  sourceName: string
  dirty: boolean
  creating: boolean
  canSave: boolean
  onTokenChange: (token: ThemeToken) => void
  onCancel: () => void
  onSave: () => Promise<string | null>
  onSaveAs: (name: string) => Promise<string | null>
}

type ResetSlotProps = {
  modified?: boolean
  onReset?: () => void
  label: string
}

const ResetSlot = (props: ResetSlotProps) => {
  const { modified, onReset, label } = props
  if (!onReset || !modified) return null
  return (
    <button
      type="button"
      aria-label={`重置${label}为保存值`}
      title="重置为保存值"
      onClick={onReset}
      className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink">
      <Icon name="reset" className="h-3.5 w-3.5 flex-none" />
    </button>
  )
}
ResetSlot.displayName = 'ResetSlot'

type Rgb = [number, number, number]

function parseHexColor(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '')
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null
  const expanded = hex.length === 3 ? hex.replace(/./g, (char) => char + char) : hex
  return [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16)) as Rgb
}

function relativeLuminance(rgb: Rgb): number {
  const channel = (value: number): number => {
    const ratio = value / 255
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a)
  const second = relativeLuminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

function contrastWarning(
  foreground: string,
  backgrounds: { label: string; color: string }[]
): string {
  const base = parseHexColor(foreground)
  if (!base) return ''
  const failures = backgrounds.flatMap(({ label, color }) => {
    const background = parseHexColor(color)
    if (!background) return []
    const ratio = contrastRatio(base, background)
    return ratio < 4.5 ? [{ label, ratio }] : []
  })
  if (failures.length === 0) return ''
  const worst = failures.reduce((lowest, item) => (item.ratio < lowest.ratio ? item : lowest))
  return `与${worst.label} ${worst.ratio.toFixed(2)}:1，低于 4.5:1`
}

type NumberControlProps = {
  label: string
  description?: string
  value: number
  range: NumericRange
  unit?: string
  modified?: boolean
  onReset?: () => void
  resetLabel?: string
  onChange: (value: number) => void
}

const NumberControl = (props: NumberControlProps) => {
  const descriptionId = useId()
  const {
    label,
    description,
    value,
    range,
    unit = '',
    modified = false,
    onReset,
    resetLabel,
    onChange,
  } = props
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-body">
        <span className="font-medium text-ink">{label}</span>
        <span className="flex items-center gap-1.5">
          <ResetSlot modified={modified} onReset={onReset} label={resetLabel ?? label} />
          <output className="tabular-nums text-ink">
            {value}
            {unit}
          </output>
        </span>
      </div>
      {description && (
        <span id={descriptionId} className="text-description text-ink-soft">
          {description}
        </span>
      )}
      <input
        type="range"
        aria-label={label}
        aria-describedby={description ? descriptionId : undefined}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-4 w-full cursor-pointer accent-primary"
      />
    </div>
  )
}
NumberControl.displayName = 'NumberControl'

type ColorControlProps = {
  label: string
  description?: string
  warning?: string
  value: string
  modified?: boolean
  onReset?: () => void
  resetLabel?: string
  onChange: (value: string) => void
}

const ColorControl = (props: ColorControlProps) => {
  const {
    label,
    description,
    warning,
    value,
    modified = false,
    onReset,
    resetLabel,
    onChange,
  } = props
  const id = useId()
  const descriptionId = `${id}-description`
  const warningId = `${id}-warning`
  const pickerId = `${id}-picker`
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerButtonRef = useRef<HTMLButtonElement>(null)
  const describedBy = warning ? warningId : description ? descriptionId : undefined

  const applyPickerColor = (hex: string): void => {
    onChange((hex.startsWith('#') ? hex : `#${hex}`).toLowerCase())
  }

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 py-2">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-medium text-ink">{label}</span>
        {warning ? (
          <span
            id={warningId}
            className="flex min-w-0 items-center gap-1 text-description text-danger">
            <Icon name="alert" className="h-3 w-3 flex-none" />
            <span className="truncate" title={warning}>
              {warning}
            </span>
          </span>
        ) : description ? (
          <span
            id={descriptionId}
            className="truncate text-description text-ink-soft"
            title={description}>
            {description}
          </span>
        ) : null}
      </span>
      <span className="flex flex-none items-center gap-2.5">
        <ResetSlot modified={modified} onReset={onReset} label={resetLabel ?? label} />
        <button
          ref={pickerButtonRef}
          type="button"
          aria-label={`选择${label}`}
          aria-expanded={pickerOpen}
          aria-controls={pickerOpen ? pickerId : undefined}
          aria-describedby={describedBy}
          onClick={() => setPickerOpen((open) => !open)}
          className="h-7 w-11 flex-none cursor-pointer rounded-full border border-line bg-white p-0.5 transition-colors hover:border-ink-soft/50">
          <span className="block h-full w-full rounded-full" style={{ backgroundColor: value }} />
        </button>
      </span>
      <Popover
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        anchorRef={pickerButtonRef}
        align="end"
        id={pickerId}
        role="dialog"
        ariaLabel={`选择${label}`}>
        <Sketch
          color={value}
          onChange={(color) => applyPickerColor(color.hex)}
          width={240}
          disableAlpha
          style={{ background: 'transparent', boxShadow: 'none', borderRadius: 0 }}
        />
      </Popover>
    </div>
  )
}
ColorControl.displayName = 'ColorControl'

type SegmentedProps<T extends string> = {
  label: string
  value: T
  options: { value: T; label: string }[]
  modified?: boolean
  onReset?: () => void
  resetLabel?: string
  onChange: (value: T) => void
}

const Segmented = <T extends string>(props: SegmentedProps<T>) => {
  const { label, value, options, modified = false, onReset, resetLabel, onChange } = props
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-body font-medium text-ink">{label}</span>
        <ResetSlot modified={modified} onReset={onReset} label={resetLabel ?? label} />
      </div>
      <div className="flex rounded-full bg-raised p-0.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`h-7 flex-1 rounded-full text-body transition-colors ${
              option.value === value
                ? 'bg-white font-medium text-ink'
                : 'text-ink-soft hover:text-ink'
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

const CODE_THEME_OPTIONS: { value: string; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'atom-one-light', label: 'Atom One Light' },
  { value: 'xcode', label: 'Xcode' },
]

const TABS = [
  { value: 'colors', label: '颜色' },
  { value: 'text', label: '正文' },
  { value: 'headings', label: '标题' },
  { value: 'components', label: '组件' },
  { value: 'code', label: '代码' },
] as const

type PanelTab = (typeof TABS)[number]['value']

/** 编辑或新建主题草稿：只改 token，实时反映到预览 */
export const ThemePanel = (props: ThemePanelProps) => {
  const {
    theme,
    baseline,
    sourceName,
    dirty,
    creating,
    canSave,
    onTokenChange,
    onCancel,
    onSave,
    onSaveAs,
  } = props
  const [tab, setTab] = useState<PanelTab>('text')
  const [level, setLevel] = useState<HeadingKey>('h1')
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState(sourceName === '完全自定义' ? '新主题' : `${sourceName} 副本`)
  const [saving, setSaving] = useState(false)
  const [savingCurrent, setSavingCurrent] = useState(false)
  const [error, setError] = useState('')
  const [currentError, setCurrentError] = useState('')

  const token = theme.token
  const heading = token[level]
  const headingBase = baseline[level]
  const followsTextColor = heading.color === undefined
  const title = creating ? (sourceName === '完全自定义' ? '新建主题' : '另存为新主题') : '编辑主题'
  const sourceLabel = sourceName === '完全自定义' ? '完全自定义' : `基于 ${sourceName}`
  const metaLabel = creating ? sourceLabel : dirty ? '未保存' : ''
  const footerError = currentError || (creating ? error : '')
  const textContrastWarning = contrastWarning(token.text.color, [
    { label: '白底', color: '#ffffff' },
    { label: '块底色', color: token.backgroundColor },
    { label: '表头底色', color: token.table.headerBackgroundColor },
  ])
  const secondaryContrastWarning = contrastWarning(token.text.secondaryColor, [
    { label: '白底', color: '#ffffff' },
  ])

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

  const patchName = (value: string): void => {
    if (creating) {
      setName(value)
      setError('')
      return
    }
    patch({ name: value })
    setCurrentError('')
  }

  const handleSaveAs = async (event: FormEvent): Promise<void> => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const message = await onSaveAs(name)
    setSaving(false)
    if (message) setError(message)
  }

  const handlePrimary = async (): Promise<void> => {
    if (creating) {
      setSaving(true)
      setError('')
      const message = await onSaveAs(name)
      setSaving(false)
      if (message) setError(message)
      return
    }
    setSavingCurrent(true)
    setCurrentError('')
    const message = await onSave()
    setSavingCurrent(false)
    if (message) setCurrentError(message)
  }

  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 w-[clamp(340px,32vw,400px)] flex-none flex-col bg-white">
      <header className="flex-none">
        <div className="flex h-11 items-center justify-between gap-3 px-6">
          <h1 className="truncate text-xl font-semibold text-ink">{title}</h1>
          {metaLabel && (
            <span className="flex-none text-description text-ink-soft">{metaLabel}</span>
          )}
        </div>
        <div className="px-6 pt-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink">主题名称</span>
            <input
              type="text"
              value={creating ? name : token.name}
              onChange={(event) => patchName(event.target.value)}
              aria-label="主题名称"
              autoFocus={creating}
              className="h-9 w-full rounded-full border border-line bg-white px-3.5 text-body text-ink focus-visible:border-primary focus-visible:outline-none"
            />
          </label>
        </div>
      </header>

      <div
        className="mt-4 flex flex-none border-b border-line px-4"
        role="tablist"
        aria-label="主题设置">
        {TABS.map((item) => {
          const selected = item.value === tab
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={`theme-tab-${item.value}`}
              aria-selected={selected}
              aria-controls="theme-panel"
              onClick={() => setTab(item.value)}
              className={`relative h-10 flex-1 text-body transition-colors ${
                selected ? 'font-medium text-ink' : 'text-ink-soft hover:text-ink'
              }`}>
              {item.label}
              {selected && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id="theme-panel"
        aria-labelledby={`theme-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {tab === 'colors' && (
          <div className="divide-y divide-line" role="group" aria-label="颜色">
            <ColorControl
              label="主色"
              description="默认用于标题装饰与引用边条"
              value={token.primary}
              modified={token.primary !== baseline.primary}
              onReset={() => patch({ primary: baseline.primary })}
              onChange={(value) => patch({ primary: value })}
            />
            <ColorControl
              label="正文色"
              description="默认正文与标题文字色"
              warning={textContrastWarning}
              value={token.text.color}
              modified={token.text.color !== baseline.text.color}
              onReset={() => patchText({ color: baseline.text.color })}
              onChange={(value) => patchText({ color: value })}
            />
            <ColorControl
              label="弱化文字"
              description="默认用于图注等次要文字"
              warning={secondaryContrastWarning}
              value={token.text.secondaryColor}
              modified={token.text.secondaryColor !== baseline.text.secondaryColor}
              onReset={() => patchText({ secondaryColor: baseline.text.secondaryColor })}
              onChange={(value) => patchText({ secondaryColor: value })}
            />
            <ColorControl
              label="块底色"
              description="默认用于引用与行内代码"
              value={token.backgroundColor}
              modified={token.backgroundColor !== baseline.backgroundColor}
              onReset={() => patch({ backgroundColor: baseline.backgroundColor })}
              onChange={(value) => patch({ backgroundColor: value })}
            />
            <ColorControl
              label="表头底色"
              description="默认用于表格表头"
              value={token.table.headerBackgroundColor}
              modified={token.table.headerBackgroundColor !== baseline.table.headerBackgroundColor}
              onReset={() =>
                patch({
                  table: {
                    ...token.table,
                    headerBackgroundColor: baseline.table.headerBackgroundColor,
                  },
                })
              }
              onChange={(value) =>
                patch({ table: { ...token.table, headerBackgroundColor: value } })
              }
            />
            <ColorControl
              label="边框色"
              description="默认用于表格边框"
              value={token.borderColor}
              modified={token.borderColor !== baseline.borderColor}
              onReset={() => patch({ borderColor: baseline.borderColor })}
              onChange={(value) => patch({ borderColor: value })}
            />
            <ColorControl
              label="分割线色"
              description="默认用于分割线"
              value={token.divider.borderTopColor}
              modified={token.divider.borderTopColor !== baseline.divider.borderTopColor}
              onReset={() =>
                patch({
                  divider: {
                    ...token.divider,
                    borderTopColor: baseline.divider.borderTopColor,
                  },
                })
              }
              onChange={(value) => patch({ divider: { ...token.divider, borderTopColor: value } })}
            />
          </div>
        )}

        {tab === 'text' && (
          <div className="flex flex-col gap-5" role="group" aria-label="正文">
            <NumberControl
              label="字号"
              value={token.text.fontSize}
              range={THEME_RANGES.fontSize}
              unit="px"
              modified={token.text.fontSize !== baseline.text.fontSize}
              onReset={() => patchText({ fontSize: baseline.text.fontSize })}
              onChange={(value) => patchText({ fontSize: value })}
            />
            <NumberControl
              label="次级字号"
              description="用于图注与上下标"
              value={token.text.secondaryFontSize}
              range={THEME_RANGES.secondaryFontSize}
              unit="px"
              modified={token.text.secondaryFontSize !== baseline.text.secondaryFontSize}
              onReset={() => patchText({ secondaryFontSize: baseline.text.secondaryFontSize })}
              onChange={(value) => patchText({ secondaryFontSize: value })}
            />
            <NumberControl
              label="行高"
              value={token.text.lineHeight}
              range={THEME_RANGES.lineHeight}
              modified={token.text.lineHeight !== baseline.text.lineHeight}
              onReset={() => patchText({ lineHeight: baseline.text.lineHeight })}
              onChange={(value) => patchText({ lineHeight: value })}
            />
            <NumberControl
              label="字距"
              value={token.text.letterSpacing}
              range={THEME_RANGES.letterSpacing}
              unit="em"
              modified={token.text.letterSpacing !== baseline.text.letterSpacing}
              onReset={() => patchText({ letterSpacing: baseline.text.letterSpacing })}
              onChange={(value) => patchText({ letterSpacing: value })}
            />
            <NumberControl
              label="段后距"
              value={token.text.marginBottom}
              range={THEME_RANGES.marginBottom}
              unit="px"
              modified={token.text.marginBottom !== baseline.text.marginBottom}
              onReset={() => patchText({ marginBottom: baseline.text.marginBottom })}
              onChange={(value) => patchText({ marginBottom: value })}
            />
          </div>
        )}

        {tab === 'headings' && (
          <div className="flex flex-col gap-5" role="group" aria-label="标题">
            <Segmented
              label="层级"
              value={level}
              options={HEADING_KEYS.map((key) => ({ value: key, label: key }))}
              onChange={setLevel}
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-body text-ink-soft">
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
              <ResetSlot
                modified={heading.color !== headingBase.color}
                onReset={() => patchHeading({ color: headingBase.color })}
                label={`${level} 标题色`}
              />
            </div>
            {!followsTextColor && (
              <ColorControl
                label="标题色"
                value={heading.color ?? token.text.color}
                onChange={(value) => patchHeading({ color: value })}
              />
            )}
            <div className="flex flex-col gap-4">
              <NumberControl
                label="字号"
                value={heading.fontSize}
                range={THEME_RANGES[`${level}FontSize`]}
                unit="px"
                modified={heading.fontSize !== headingBase.fontSize}
                onReset={() => patchHeading({ fontSize: headingBase.fontSize })}
                resetLabel={`${level} 字号`}
                onChange={(value) => patchHeading({ fontSize: value })}
              />
              <NumberControl
                label="上边距"
                value={heading.marginTop}
                range={THEME_RANGES.headingMarginTop}
                unit="px"
                modified={heading.marginTop !== headingBase.marginTop}
                onReset={() => patchHeading({ marginTop: headingBase.marginTop })}
                resetLabel={`${level} 上边距`}
                onChange={(value) => patchHeading({ marginTop: value })}
              />
              <NumberControl
                label="下边距"
                value={heading.marginBottom}
                range={THEME_RANGES.headingMarginBottom}
                unit="px"
                modified={heading.marginBottom !== headingBase.marginBottom}
                onReset={() => patchHeading({ marginBottom: headingBase.marginBottom })}
                resetLabel={`${level} 下边距`}
                onChange={(value) => patchHeading({ marginBottom: value })}
              />
            </div>
            <Segmented
              label="对齐"
              value={heading.textAlign}
              options={[...ALIGN_OPTIONS]}
              modified={heading.textAlign !== headingBase.textAlign}
              onReset={() => patchHeading({ textAlign: headingBase.textAlign })}
              resetLabel={`${level} 对齐`}
              onChange={(value) => patchHeading({ textAlign: value })}
            />
            <Segmented
              label="装饰"
              value={heading.decoration}
              options={DECORATION_OPTIONS}
              modified={heading.decoration !== headingBase.decoration}
              onReset={() => patchHeading({ decoration: headingBase.decoration })}
              resetLabel={`${level} 装饰`}
              onChange={(value) => patchHeading({ decoration: value })}
            />
          </div>
        )}

        {tab === 'components' && (
          <div className="flex flex-col gap-6" role="group" aria-label="组件">
            <section className="flex flex-col gap-4">
              <h2 className="text-body font-medium text-ink">引用</h2>
              <NumberControl
                label="引用内距"
                value={token.quote.padding}
                range={THEME_RANGES.quotePadding}
                unit="px"
                modified={token.quote.padding !== baseline.quote.padding}
                onReset={() =>
                  patch({ quote: { ...token.quote, padding: baseline.quote.padding } })
                }
                onChange={(value) => patch({ quote: { ...token.quote, padding: value } })}
              />
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-body font-medium text-ink">表格与图片</h2>
              <NumberControl
                label="表格内距"
                value={token.table.padding}
                range={THEME_RANGES.tablePadding}
                unit="px"
                modified={token.table.padding !== baseline.table.padding}
                onReset={() =>
                  patch({ table: { ...token.table, padding: baseline.table.padding } })
                }
                onChange={(value) => patch({ table: { ...token.table, padding: value } })}
              />
              <NumberControl
                label="图上距"
                value={token.image.marginTop}
                range={THEME_RANGES.imageMarginTop}
                unit="px"
                modified={token.image.marginTop !== baseline.image.marginTop}
                onReset={() =>
                  patch({ image: { ...token.image, marginTop: baseline.image.marginTop } })
                }
                onChange={(value) => patch({ image: { ...token.image, marginTop: value } })}
              />
              <NumberControl
                label="图下距"
                value={token.image.marginBottom}
                range={THEME_RANGES.imageMarginBottom}
                unit="px"
                modified={token.image.marginBottom !== baseline.image.marginBottom}
                onReset={() =>
                  patch({
                    image: { ...token.image, marginBottom: baseline.image.marginBottom },
                  })
                }
                onChange={(value) => patch({ image: { ...token.image, marginBottom: value } })}
              />
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="text-body font-medium text-ink">圆角与分割线</h2>
              <NumberControl
                label="圆角"
                value={token.borderRadius}
                range={THEME_RANGES.borderRadius}
                unit="px"
                modified={token.borderRadius !== baseline.borderRadius}
                onReset={() => patch({ borderRadius: baseline.borderRadius })}
                onChange={(value) => patch({ borderRadius: value })}
              />
              <Segmented
                label="分割线"
                value={token.divider.borderTopStyle}
                options={[...DIVIDER_OPTIONS]}
                modified={token.divider.borderTopStyle !== baseline.divider.borderTopStyle}
                onReset={() =>
                  patch({
                    divider: {
                      ...token.divider,
                      borderTopStyle: baseline.divider.borderTopStyle,
                    },
                  })
                }
                resetLabel="分割线样式"
                onChange={(value) =>
                  patch({ divider: { ...token.divider, borderTopStyle: value } })
                }
              />
            </section>
          </div>
        )}

        {tab === 'code' && (
          <div className="flex flex-col gap-4" role="group" aria-label="代码">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-ink">语法主题</span>
                <ResetSlot
                  modified={token.code.hljsTheme !== baseline.code.hljsTheme}
                  onReset={() =>
                    patch({ code: { ...token.code, hljsTheme: baseline.code.hljsTheme } })
                  }
                  label="语法主题"
                />
              </div>
              <Dropdown
                label="语法主题"
                value={token.code.hljsTheme}
                options={CODE_THEME_OPTIONS}
                onChange={(value) => patch({ code: { ...token.code, hljsTheme: value } })}
              />
            </div>
            <div className="flex min-h-11 items-center justify-between gap-3 py-2">
              <label htmlFor="code-background-color" className="text-body font-medium text-ink">
                背景色
              </label>
              <span className="flex flex-none items-center gap-2.5">
                {token.code.backgroundColor ? (
                  <>
                    <span className="text-body tabular-nums text-ink-soft">
                      {token.code.backgroundColor.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => patch({ code: { ...token.code, backgroundColor: undefined } })}
                      className="text-body text-ink-soft transition-colors hover:text-ink">
                      重置
                    </button>
                  </>
                ) : (
                  <span className="text-body text-ink-soft">跟随语法主题</span>
                )}
                <ResetSlot
                  modified={
                    token.code.backgroundColor !== baseline.code.backgroundColor &&
                    baseline.code.backgroundColor !== undefined
                  }
                  onReset={() =>
                    patch({
                      code: { ...token.code, backgroundColor: baseline.code.backgroundColor },
                    })
                  }
                  label="代码块背景色"
                />
                <input
                  id="code-background-color"
                  type="color"
                  value={
                    token.code.backgroundColor ?? highlightThemeBackground(token.code.hljsTheme)
                  }
                  onChange={(event) =>
                    patch({ code: { ...token.code, backgroundColor: event.target.value } })
                  }
                  className="h-7 w-11 cursor-pointer rounded-full border border-line bg-white p-0.5 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                />
              </span>
            </div>
            <NumberControl
              label="代码内距"
              value={token.code.padding}
              range={THEME_RANGES.codePadding}
              unit="px"
              modified={token.code.padding !== baseline.code.padding}
              onReset={() => patch({ code: { ...token.code, padding: baseline.code.padding } })}
              onChange={(value) => patch({ code: { ...token.code, padding: value } })}
            />
            <NumberControl
              label="代码行高"
              value={token.code.lineHeight}
              range={THEME_RANGES.codeLineHeight}
              modified={token.code.lineHeight !== baseline.code.lineHeight}
              onReset={() =>
                patch({ code: { ...token.code, lineHeight: baseline.code.lineHeight } })
              }
              onChange={(value) => patch({ code: { ...token.code, lineHeight: value } })}
            />
          </div>
        )}
      </div>

      <footer className="flex-none border-t border-line px-6 py-3">
        {saveOpen ? (
          <form onSubmit={handleSaveAs} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-body font-medium text-ink">另存为新主题</span>
              <button
                type="button"
                onClick={() => {
                  setSaveOpen(false)
                  setError('')
                }}
                className="text-body text-ink-soft transition-colors hover:text-ink">
                取消
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError('')
                }}
                aria-label="新主题名称"
                autoFocus
                className="h-8 min-w-0 flex-1 rounded-full border border-line bg-white px-3 text-body text-ink focus-visible:border-primary focus-visible:outline-none"
              />
              <Button type="submit" variant="primary" disabled={saving} className="h-8">
                {saving ? '保存中' : '创建'}
              </Button>
            </div>
            {error && (
              <p role="status" className="text-body text-danger">
                {error}
              </p>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onCancel}>
              取消
            </Button>
            <span className="flex-1" />
            {!creating && canSave && (
              <Button variant="secondary" onClick={() => setSaveOpen(true)}>
                另存为
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => void handlePrimary()}
              disabled={saving || savingCurrent}>
              {creating ? (saving ? '保存中' : '创建主题') : savingCurrent ? '保存中' : '保存'}
            </Button>
          </div>
        )}
        {!saveOpen && footerError && (
          <p role="alert" className="mt-2 text-body text-danger">
            {footerError}
          </p>
        )}
      </footer>
    </section>
  )
}

ThemePanel.displayName = 'ThemePanel'
