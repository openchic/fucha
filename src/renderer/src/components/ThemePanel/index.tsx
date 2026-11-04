import type { HeadingDecoration, HeadingToken, ThemeDefinition, ThemeToken } from '@shared/types'
import { HEADING_KEYS, THEME_RANGES, type HeadingKey, type NumericRange } from '@shared/theme'
import { type ReactNode, useId, useRef, useState } from 'react'
import { Sketch } from '@uiw/react-color'
import { Dropdown, type DropdownOption } from '../Dropdown'
import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { Segmented } from '../Segmented'
import { NumberInput } from '../NumberInput'
import { highlightThemeBackground } from '../../theme/highlight'

type ThemePanelProps = {
  theme: ThemeDefinition
  baseline: ThemeToken
  title: string
  header: ReactNode
  footer: ReactNode
  onTokenChange: (token: ThemeToken) => void
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
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5 text-body">
        <span className="field-label text-ink">{label}</span>
        {description && (
          <span id={descriptionId} className="text-description text-ink-soft">
            {description}
          </span>
        )}
      </span>
      <span className="flex flex-none items-center gap-1.5">
        <ResetSlot modified={modified} onReset={onReset} label={resetLabel ?? label} />
        <NumberInput
          label={label}
          value={value}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={unit}
          describedBy={description ? descriptionId : undefined}
          onChange={onChange}
        />
      </span>
    </div>
  )
}
NumberControl.displayName = 'NumberControl'

type ColorControlProps = {
  label: string
  description?: string
  warning?: string
  value?: string
  fallbackValue?: string
  modified?: boolean
  onReset?: () => void
  resetLabel?: string
  compact?: boolean
  onChange: (value: string) => void
}

const ColorControl = (props: ColorControlProps) => {
  const {
    label,
    description,
    warning,
    value,
    fallbackValue = '#ffffff',
    modified = false,
    onReset,
    resetLabel,
    compact = false,
    onChange,
  } = props
  const id = useId()
  const descriptionId = `${id}-description`
  const warningId = `${id}-warning`
  const pickerId = `${id}-picker`
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerButtonRef = useRef<HTMLButtonElement>(null)
  const describedBy = warning ? warningId : description ? descriptionId : undefined
  const displayColor = value ?? fallbackValue

  const applyPickerColor = (hex: string): void => {
    onChange((hex.startsWith('#') ? hex : `#${hex}`).toLowerCase())
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        compact ? 'min-h-8' : 'min-h-11 py-2.5'
      }`}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="field-label text-body text-ink">{label}</span>
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
        <span className="group/color relative flex-none">
          <button
            ref={pickerButtonRef}
            type="button"
            aria-label={`选择${label}`}
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? pickerId : undefined}
            aria-describedby={describedBy}
            onClick={() => setPickerOpen((open) => !open)}
            className="h-7 w-11 flex-none cursor-pointer rounded-full border border-line bg-white p-0.5 transition-colors hover:border-ink-soft/50">
            <span
              className="block h-full w-full rounded-full"
              style={{ backgroundColor: displayColor }}
            />
          </button>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-full z-10 mr-2 -translate-y-1/2 rounded-md bg-ink px-2 py-1 text-description whitespace-nowrap text-white opacity-0 group-hover/color:opacity-100">
            {displayColor.toUpperCase()}
          </span>
        </span>
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
          color={displayColor}
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

type DropdownFieldProps = {
  label: string
  value: string
  options: DropdownOption[]
  modified?: boolean
  onReset?: () => void
  resetLabel?: string
  onChange: (value: string) => void
}

const DropdownField = (props: DropdownFieldProps) => {
  const { label, value, options, modified = false, onReset, resetLabel, onChange } = props
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <span className="field-label text-body text-ink">{label}</span>
      <span className="flex flex-none items-center gap-1.5">
        <ResetSlot modified={modified} onReset={onReset} label={resetLabel ?? label} />
        <Dropdown label={label} value={value} options={options} onChange={onChange} />
      </span>
    </div>
  )
}
DropdownField.displayName = 'DropdownField'

const ALIGN_OPTIONS = [
  { value: 'left', label: '左对齐' },
  { value: 'center', label: '居中' },
] as const

const FONT_WEIGHT_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: '100', label: '极细', hint: '100' },
  { value: '200', label: '特细', hint: '200' },
  { value: '300', label: '细体', hint: '300' },
  { value: '400', label: '常规', hint: '400' },
  { value: '500', label: '中等', hint: '500' },
  { value: '600', label: '半粗', hint: '600' },
  { value: '700', label: '粗体', hint: '700' },
]

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
  { value: 'typography', label: '排版' },
  { value: 'code', label: '代码' },
] as const

type PanelTab = (typeof TABS)[number]['value']

/** 编辑或新建主题草稿：只改 token，实时反映到预览 */
export const ThemePanel = (props: ThemePanelProps) => {
  const { theme, baseline, title, header, footer, onTokenChange } = props
  const [tab, setTab] = useState<PanelTab>('typography')
  const [level, setLevel] = useState<HeadingKey>('h1')

  const token = theme.token
  const heading = token[level]
  const headingBase = baseline[level]
  const textContrastBackgrounds = [
    { label: '白底', color: '#ffffff' },
    { label: '引用背景色', color: token.backgroundColor },
    { label: '行内代码背景色', color: token.code.inlineBackgroundColor },
    { label: '表头背景色', color: token.table.headerBackgroundColor },
  ]
  const textContrastWarning = contrastWarning(token.text.color, textContrastBackgrounds)
  const headingContrastWarning = contrastWarning(token.headingColor, textContrastBackgrounds)
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

  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 w-[clamp(340px,32vw,400px)] flex-none flex-col bg-white">
      {header}
      <div className="mx-6 mt-5 flex-none">
        <Segmented
          label="主题设置"
          value={tab}
          options={TABS}
          idPrefix="theme-tab"
          panelId="theme-panel"
          onChange={setTab}
        />
      </div>

      <div
        key={tab}
        role="tabpanel"
        id="theme-panel"
        aria-labelledby={`theme-tab-${tab}`}
        className="my-2 min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
        {tab === 'colors' && (
          <div
            className="flex flex-col gap-6 [&_.field-label]:text-description"
            role="group"
            aria-label="颜色">
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">基础</h2>
              <div className="[&>div]:py-1.5 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
                <ColorControl
                  compact
                  label="主题色"
                  value={token.primary}
                  modified={token.primary !== baseline.primary}
                  onReset={() => patch({ primary: baseline.primary })}
                  onChange={(value) => patch({ primary: value })}
                />
                <ColorControl
                  compact
                  label="正文色"
                  warning={textContrastWarning}
                  value={token.text.color}
                  modified={token.text.color !== baseline.text.color}
                  onReset={() => patchText({ color: baseline.text.color })}
                  onChange={(value) => patchText({ color: value })}
                />
                <ColorControl
                  compact
                  label="标题色"
                  warning={headingContrastWarning}
                  value={token.headingColor}
                  modified={token.headingColor !== baseline.headingColor}
                  onReset={() => patch({ headingColor: baseline.headingColor })}
                  onChange={(value) => patch({ headingColor: value })}
                />
                <ColorControl
                  compact
                  label="次级文字色"
                  warning={secondaryContrastWarning}
                  value={token.text.secondaryColor}
                  modified={token.text.secondaryColor !== baseline.text.secondaryColor}
                  onReset={() => patchText({ secondaryColor: baseline.text.secondaryColor })}
                  onChange={(value) => patchText({ secondaryColor: value })}
                />
              </div>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">背景</h2>
              <div className="[&>div]:py-1.5 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
                <ColorControl
                  compact
                  label="引用背景色"
                  value={token.backgroundColor}
                  modified={token.backgroundColor !== baseline.backgroundColor}
                  onReset={() => patch({ backgroundColor: baseline.backgroundColor })}
                  onChange={(value) => patch({ backgroundColor: value })}
                />
                <ColorControl
                  compact
                  label="行内代码背景色"
                  value={token.code.inlineBackgroundColor}
                  modified={
                    token.code.inlineBackgroundColor !== baseline.code.inlineBackgroundColor
                  }
                  onReset={() =>
                    patch({
                      code: {
                        ...token.code,
                        inlineBackgroundColor: baseline.code.inlineBackgroundColor,
                      },
                    })
                  }
                  onChange={(value) =>
                    patch({ code: { ...token.code, inlineBackgroundColor: value } })
                  }
                />
                <ColorControl
                  compact
                  label="表头背景色"
                  value={token.table.headerBackgroundColor}
                  modified={
                    token.table.headerBackgroundColor !== baseline.table.headerBackgroundColor
                  }
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
              </div>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">线条</h2>
              <div className="[&>div]:py-1.5 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
                <ColorControl
                  compact
                  label="表格边框色"
                  value={token.borderColor}
                  modified={token.borderColor !== baseline.borderColor}
                  onReset={() => patch({ borderColor: baseline.borderColor })}
                  onChange={(value) => patch({ borderColor: value })}
                />
                <ColorControl
                  compact
                  label="分割线色"
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
                  onChange={(value) =>
                    patch({ divider: { ...token.divider, borderTopColor: value } })
                  }
                />
              </div>
            </section>
          </div>
        )}

        {tab === 'typography' && (
          <div
            className="flex flex-col gap-6 [&_.field-label]:text-description [&_.field-value]:text-description"
            role="group"
            aria-label="排版">
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">正文</h2>
              <div>
                <div className="py-1.5 first:pt-0 last:pb-0">
                  <NumberControl
                    label="字号"
                    value={token.text.fontSize}
                    range={THEME_RANGES.fontSize}
                    unit="px"
                    modified={token.text.fontSize !== baseline.text.fontSize}
                    onReset={() => patchText({ fontSize: baseline.text.fontSize })}
                    onChange={(value) => patchText({ fontSize: value })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="次级字号"
                    value={token.text.secondaryFontSize}
                    range={THEME_RANGES.secondaryFontSize}
                    unit="px"
                    modified={token.text.secondaryFontSize !== baseline.text.secondaryFontSize}
                    onReset={() =>
                      patchText({ secondaryFontSize: baseline.text.secondaryFontSize })
                    }
                    onChange={(value) => patchText({ secondaryFontSize: value })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="行高"
                    value={token.text.lineHeight}
                    range={THEME_RANGES.lineHeight}
                    modified={token.text.lineHeight !== baseline.text.lineHeight}
                    onReset={() => patchText({ lineHeight: baseline.text.lineHeight })}
                    onChange={(value) => patchText({ lineHeight: value })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="字距"
                    value={token.text.letterSpacing}
                    range={THEME_RANGES.letterSpacing}
                    unit="em"
                    modified={token.text.letterSpacing !== baseline.text.letterSpacing}
                    onReset={() => patchText({ letterSpacing: baseline.text.letterSpacing })}
                    onChange={(value) => patchText({ letterSpacing: value })}
                  />
                </div>
                <div className="py-1.5 last:pb-0">
                  <NumberControl
                    label="段落间距"
                    value={token.text.marginBottom}
                    range={THEME_RANGES.marginBottom}
                    unit="px"
                    modified={token.text.marginBottom !== baseline.text.marginBottom}
                    onReset={() => patchText({ marginBottom: baseline.text.marginBottom })}
                    onChange={(value) => patchText({ marginBottom: value })}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <h2 className="text-body text-ink">标题</h2>
                <Dropdown
                  label="标题层级"
                  value={level}
                  options={HEADING_KEYS.map((key) => ({ value: key, label: key }))}
                  onChange={(value) => {
                    const next = HEADING_KEYS.find((key) => key === value)
                    if (next) setLevel(next)
                  }}
                />
              </div>
              <div>
                <div className="py-1.5 first:pt-0">
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
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="行高"
                    value={heading.lineHeight}
                    range={THEME_RANGES.lineHeight}
                    modified={heading.lineHeight !== headingBase.lineHeight}
                    onReset={() => patchHeading({ lineHeight: headingBase.lineHeight })}
                    resetLabel={`${level} 行高`}
                    onChange={(value) => patchHeading({ lineHeight: value })}
                  />
                </div>
                <div className="py-1.5">
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
                </div>
                <div className="py-1.5">
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
                <div className="py-1.5">
                  <DropdownField
                    label="对齐"
                    value={heading.textAlign}
                    options={[...ALIGN_OPTIONS]}
                    modified={heading.textAlign !== headingBase.textAlign}
                    onReset={() => patchHeading({ textAlign: headingBase.textAlign })}
                    resetLabel={`${level} 对齐`}
                    onChange={(value) => {
                      const next = ALIGN_OPTIONS.find((option) => option.value === value)
                      if (next) patchHeading({ textAlign: next.value })
                    }}
                  />
                </div>
                <div className="py-1.5">
                  <DropdownField
                    label="字重"
                    value={String(heading.fontWeight)}
                    options={FONT_WEIGHT_OPTIONS}
                    modified={heading.fontWeight !== headingBase.fontWeight}
                    onReset={() => patchHeading({ fontWeight: headingBase.fontWeight })}
                    resetLabel={`${level} 字重`}
                    onChange={(value) => {
                      const next = FONT_WEIGHT_OPTIONS.find((option) => option.value === value)
                      if (next) patchHeading({ fontWeight: Number(next.value) })
                    }}
                  />
                </div>
                <div className="py-1.5 last:pb-0">
                  <DropdownField
                    label="装饰"
                    value={heading.decoration}
                    options={DECORATION_OPTIONS}
                    modified={heading.decoration !== headingBase.decoration}
                    onReset={() => patchHeading({ decoration: headingBase.decoration })}
                    resetLabel={`${level} 装饰`}
                    onChange={(value) => {
                      const next = DECORATION_OPTIONS.find((option) => option.value === value)
                      if (next) patchHeading({ decoration: next.value })
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">引用</h2>
              <div>
                <div className="py-1.5 first:pt-0">
                  <NumberControl
                    label="上下内距"
                    value={token.quote.paddingBlock}
                    range={THEME_RANGES.quotePadding}
                    unit="px"
                    modified={token.quote.paddingBlock !== baseline.quote.paddingBlock}
                    onReset={() =>
                      patch({
                        quote: { ...token.quote, paddingBlock: baseline.quote.paddingBlock },
                      })
                    }
                    onChange={(value) => patch({ quote: { ...token.quote, paddingBlock: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="左右内距"
                    value={token.quote.paddingInline}
                    range={THEME_RANGES.quotePadding}
                    unit="px"
                    modified={token.quote.paddingInline !== baseline.quote.paddingInline}
                    onReset={() =>
                      patch({
                        quote: { ...token.quote, paddingInline: baseline.quote.paddingInline },
                      })
                    }
                    onChange={(value) => patch({ quote: { ...token.quote, paddingInline: value } })}
                  />
                </div>
                <div className="py-1.5 last:pb-0">
                  <NumberControl
                    label="圆角"
                    value={token.quote.borderRadius}
                    range={THEME_RANGES.borderRadius}
                    unit="px"
                    modified={token.quote.borderRadius !== baseline.quote.borderRadius}
                    onReset={() =>
                      patch({
                        quote: { ...token.quote, borderRadius: baseline.quote.borderRadius },
                      })
                    }
                    onChange={(value) => patch({ quote: { ...token.quote, borderRadius: value } })}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">表格</h2>
              <div>
                <div className="py-1.5 first:pt-0">
                  <NumberControl
                    label="上下内距"
                    value={token.table.paddingBlock}
                    range={THEME_RANGES.tablePadding}
                    unit="px"
                    modified={token.table.paddingBlock !== baseline.table.paddingBlock}
                    onReset={() =>
                      patch({
                        table: { ...token.table, paddingBlock: baseline.table.paddingBlock },
                      })
                    }
                    onChange={(value) => patch({ table: { ...token.table, paddingBlock: value } })}
                  />
                </div>
                <div className="py-1.5 last:pb-0">
                  <NumberControl
                    label="左右内距"
                    value={token.table.paddingInline}
                    range={THEME_RANGES.tablePadding}
                    unit="px"
                    modified={token.table.paddingInline !== baseline.table.paddingInline}
                    onReset={() =>
                      patch({
                        table: { ...token.table, paddingInline: baseline.table.paddingInline },
                      })
                    }
                    onChange={(value) => patch({ table: { ...token.table, paddingInline: value } })}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">图片</h2>
              <div>
                <div className="py-1.5 first:pt-0">
                  <NumberControl
                    label="上边距"
                    value={token.image.marginTop}
                    range={THEME_RANGES.imageMarginTop}
                    unit="px"
                    modified={token.image.marginTop !== baseline.image.marginTop}
                    onReset={() =>
                      patch({ image: { ...token.image, marginTop: baseline.image.marginTop } })
                    }
                    onChange={(value) => patch({ image: { ...token.image, marginTop: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="下边距"
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
                </div>
                <div className="py-1.5 last:pb-0">
                  <NumberControl
                    label="圆角"
                    value={token.image.borderRadius}
                    range={THEME_RANGES.borderRadius}
                    unit="px"
                    modified={token.image.borderRadius !== baseline.image.borderRadius}
                    onReset={() =>
                      patch({
                        image: { ...token.image, borderRadius: baseline.image.borderRadius },
                      })
                    }
                    onChange={(value) => patch({ image: { ...token.image, borderRadius: value } })}
                  />
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">分割线</h2>
              <div>
                <div className="py-1.5 first:pt-0">
                  <NumberControl
                    label="上边距"
                    value={token.divider.marginTop}
                    range={THEME_RANGES.dividerMarginTop}
                    unit="px"
                    modified={token.divider.marginTop !== baseline.divider.marginTop}
                    onReset={() =>
                      patch({
                        divider: { ...token.divider, marginTop: baseline.divider.marginTop },
                      })
                    }
                    onChange={(value) => patch({ divider: { ...token.divider, marginTop: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="下边距"
                    value={token.divider.marginBottom}
                    range={THEME_RANGES.dividerMarginBottom}
                    unit="px"
                    modified={token.divider.marginBottom !== baseline.divider.marginBottom}
                    onReset={() =>
                      patch({
                        divider: { ...token.divider, marginBottom: baseline.divider.marginBottom },
                      })
                    }
                    onChange={(value) =>
                      patch({ divider: { ...token.divider, marginBottom: value } })
                    }
                  />
                </div>
                <div className="py-1.5 last:pb-0">
                  <DropdownField
                    label="样式"
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
                    onChange={(value) => {
                      const next = DIVIDER_OPTIONS.find((option) => option.value === value)
                      if (next) patch({ divider: { ...token.divider, borderTopStyle: next.value } })
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {tab === 'code' && (
          <div
            className="flex flex-col gap-6 [&_.field-label]:text-description [&_.field-value]:text-description"
            role="group"
            aria-label="代码">
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">代码块</h2>
              <div>
                <div className="py-1.5 first:pt-0">
                  <DropdownField
                    label="语法主题"
                    value={token.code.hljsTheme}
                    options={CODE_THEME_OPTIONS}
                    modified={token.code.hljsTheme !== baseline.code.hljsTheme}
                    onReset={() =>
                      patch({ code: { ...token.code, hljsTheme: baseline.code.hljsTheme } })
                    }
                    onChange={(value) => patch({ code: { ...token.code, hljsTheme: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <ColorControl
                    label="背景色"
                    compact
                    value={token.code.backgroundColor}
                    fallbackValue={highlightThemeBackground(token.code.hljsTheme)}
                    modified={token.code.backgroundColor !== baseline.code.backgroundColor}
                    onReset={() =>
                      patch({
                        code: {
                          ...token.code,
                          backgroundColor: baseline.code.backgroundColor,
                        },
                      })
                    }
                    resetLabel="代码块背景色"
                    onChange={(value) => patch({ code: { ...token.code, backgroundColor: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="上下内距"
                    resetLabel="代码上下内距"
                    value={token.code.paddingBlock}
                    range={THEME_RANGES.codePadding}
                    unit="px"
                    modified={token.code.paddingBlock !== baseline.code.paddingBlock}
                    onReset={() =>
                      patch({
                        code: { ...token.code, paddingBlock: baseline.code.paddingBlock },
                      })
                    }
                    onChange={(value) => patch({ code: { ...token.code, paddingBlock: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="左右内距"
                    resetLabel="代码左右内距"
                    value={token.code.paddingInline}
                    range={THEME_RANGES.codePadding}
                    unit="px"
                    modified={token.code.paddingInline !== baseline.code.paddingInline}
                    onReset={() =>
                      patch({
                        code: { ...token.code, paddingInline: baseline.code.paddingInline },
                      })
                    }
                    onChange={(value) => patch({ code: { ...token.code, paddingInline: value } })}
                  />
                </div>
                <div className="py-1.5">
                  <NumberControl
                    label="行高"
                    resetLabel="代码行高"
                    value={token.code.lineHeight}
                    range={THEME_RANGES.codeLineHeight}
                    modified={token.code.lineHeight !== baseline.code.lineHeight}
                    onReset={() =>
                      patch({ code: { ...token.code, lineHeight: baseline.code.lineHeight } })
                    }
                    onChange={(value) => patch({ code: { ...token.code, lineHeight: value } })}
                  />
                </div>
                <div className="py-1.5 last:pb-0">
                  <NumberControl
                    label="圆角"
                    resetLabel="代码块圆角"
                    value={token.code.borderRadius}
                    range={THEME_RANGES.borderRadius}
                    unit="px"
                    modified={token.code.borderRadius !== baseline.code.borderRadius}
                    onReset={() =>
                      patch({ code: { ...token.code, borderRadius: baseline.code.borderRadius } })
                    }
                    onChange={(value) => patch({ code: { ...token.code, borderRadius: value } })}
                  />
                </div>
              </div>
            </section>
            <section className="flex flex-col gap-4">
              <h2 className="border-b border-line pb-2 text-body text-ink">行内代码</h2>
              <div>
                <div className="py-1.5 first:pt-0 last:pb-0">
                  <NumberControl
                    label="圆角"
                    resetLabel="行内代码圆角"
                    value={token.code.inlineBorderRadius}
                    range={THEME_RANGES.borderRadius}
                    unit="px"
                    modified={token.code.inlineBorderRadius !== baseline.code.inlineBorderRadius}
                    onReset={() =>
                      patch({
                        code: {
                          ...token.code,
                          inlineBorderRadius: baseline.code.inlineBorderRadius,
                        },
                      })
                    }
                    onChange={(value) =>
                      patch({ code: { ...token.code, inlineBorderRadius: value } })
                    }
                  />
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
      {footer}
    </section>
  )
}

ThemePanel.displayName = 'ThemePanel'
