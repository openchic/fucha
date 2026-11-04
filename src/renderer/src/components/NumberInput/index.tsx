import type { ChangeEvent, KeyboardEvent } from 'react'
import { useRef, useState } from 'react'
import { Icon } from '../Icon'
import './index.css'

type NumberInputProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  describedBy?: string
  onChange: (value: number) => void
}

function stepDecimals(step: number): number {
  const text = String(step)
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

function clampToStep(value: number, min: number, max: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step
  const clamped = Math.min(max, Math.max(min, snapped))
  return Number(clamped.toFixed(stepDecimals(step)))
}

/** 数值输入：直接键入或步进，提交时按范围与步长归整 */
export const NumberInput = (props: NumberInputProps) => {
  const { label, value, min, max, step, unit = '', describedBy, onChange } = props
  const [draft, setDraft] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const commit = (raw: string): void => {
    setDraft(null)
    if (raw.trim() === '') return
    const next = Number(raw)
    if (!Number.isFinite(next)) return
    onChange(clampToStep(next, min, max, step))
  }

  const stepBy = (direction: 1 | -1): void => {
    setDraft(null)
    onChange(clampToStep(value + direction * step, min, max, step))
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setDraft(event.target.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(draft ?? String(value))
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRef.current = true
      setDraft(null)
      event.currentTarget.blur()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      stepBy(event.key === 'ArrowUp' ? 1 : -1)
    }
  }

  const handleBlur = (): void => {
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    if (draft !== null) commit(draft)
  }

  return (
    <div className="number-input flex h-8 w-30 flex-none items-center rounded-full border border-line px-0.5 transition-[border-color] hover:border-ink-soft/40">
      <button
        type="button"
        tabIndex={-1}
        aria-label={`减小${label}`}
        disabled={value <= min}
        onClick={() => stepBy(-1)}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:text-ink-soft/40 disabled:hover:bg-transparent">
        <Icon name="minus" className="h-3.5 w-3.5 flex-none" />
      </button>
      <span className="flex h-7 flex-1 items-center justify-center">
        <input
          type="number"
          inputMode="decimal"
          aria-label={label}
          aria-describedby={describedBy}
          min={min}
          max={max}
          step={step}
          value={draft ?? String(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="field-value h-7 w-9 bg-transparent p-0 pr-1 text-right text-body tabular-nums text-ink focus-visible:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-description text-ink-soft">{unit}</span>
      </span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`增大${label}`}
        disabled={value >= max}
        onClick={() => stepBy(1)}
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink disabled:cursor-not-allowed disabled:text-ink-soft/40 disabled:hover:bg-transparent">
        <Icon name="plus" className="h-3.5 w-3.5 flex-none" />
      </button>
    </div>
  )
}
NumberInput.displayName = 'NumberInput'
