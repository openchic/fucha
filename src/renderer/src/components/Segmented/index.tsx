export type SegmentedOption<T extends string> = {
  value: T
  label: string
}

type SegmentedProps<T extends string> = {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  idPrefix: string
  panelId: string
  onChange: (value: T) => void
}

/** 圆角分段 tab，切换对应面板 */
export const Segmented = <T extends string>(props: SegmentedProps<T>) => {
  const { label, value, options, idPrefix, panelId, onChange } = props
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  return (
    <div className="relative flex rounded-full bg-panel p-0.5" role="tablist" aria-label={label}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-full bg-accent-soft transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 0.25rem) / ${options.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`${idPrefix}-${option.value}`}
            aria-selected={selected}
            aria-controls={panelId}
            onClick={() => onChange(option.value)}
            className={`relative h-7 flex-1 rounded-full text-body transition-colors ${
              selected ? 'text-ink' : 'text-ink-soft hover:text-ink'
            }`}>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
Segmented.displayName = 'Segmented'
