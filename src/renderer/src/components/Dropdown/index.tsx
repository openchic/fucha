import type { KeyboardEvent } from 'react'
import { useId, useRef, useState } from 'react'
import { Icon } from '../Icon'
import { Popover } from '../Popover'
import { Tooltip } from '../Tooltip'

export type DropdownOption = {
  value: string
  label: string
  hint?: string
}

export type DropdownAction = {
  label: string
  onSelect: () => void
}

type DropdownProps = {
  label: string
  value: string
  options: DropdownOption[]
  actions?: DropdownAction[]
  tooltip?: string
  onChange: (value: string) => void
}

/** 轻量下拉：触发按钮只占用文字宽度，弹层支持键盘、焦点与外部点击关闭 */
export const Dropdown = (props: DropdownProps) => {
  const { label, value, options, actions, tooltip, onChange } = props
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedOptionRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  )
  const current = options[selectedIndex]

  const close = (): void => {
    setIsOpen(false)
  }

  const moveFocus = (delta: number): void => {
    if (options.length === 0) return
    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement)
    const base = currentIndex < 0 ? selectedIndex : currentIndex
    const next = (base + delta + options.length) % options.length
    optionRefs.current[next]?.focus()
  }

  const handleMenuKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      optionRefs.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      optionRefs.current[options.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      if (!actions?.length) setIsOpen(false)
    }
  }

  const handleTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
    } else if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleSelect = (next: string): void => {
    onChange(next)
    close()
  }

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      aria-controls={menuId}
      aria-label={`${label}：${current?.label ?? ''}`}
      onClick={() => setIsOpen((open) => !open)}
      onKeyDown={handleTriggerKeyDown}
      className={`field-value flex h-7 max-w-40 items-center gap-1.5 rounded-full pr-2 pl-3 text-body transition-colors ${
        isOpen ? 'bg-accent-soft text-ink' : 'text-ink hover:bg-raised'
      }`}>
      <span className="truncate">{current?.label}</span>
      <Icon
        name="chevron-down"
        className={`h-3.5 w-3.5 flex-none transition-transform ${isOpen ? 'rotate-180 text-accent' : ''}`}
      />
    </button>
  )

  return (
    <>
      {tooltip ? (
        <Tooltip label={tooltip} hidden={isOpen}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <Popover
        open={isOpen}
        onOpenChange={setIsOpen}
        anchorRef={triggerRef}
        returnFocusRef={triggerRef}
        align="end"
        id={menuId}
        className="min-w-40 max-w-56"
        initialFocusRef={selectedOptionRef}
        onKeyDown={handleMenuKeyDown}>
        <div role="listbox" aria-label={label} className="flex flex-col gap-0.5">
          {options.map((option, index) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node
                  if (isSelected) selectedOptionRef.current = node
                }}
                type="button"
                role="option"
                id={`${menuId}-option-${index}`}
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left text-body transition-colors ${
                  isSelected
                    ? 'bg-accent-soft text-ink hover:bg-accent-hover'
                    : 'text-ink-soft hover:bg-raised'
                }`}>
                <span className="min-w-0 truncate">{option.label}</span>
                <span className="ml-auto flex flex-none items-center gap-2">
                  {option.hint && (
                    <span className="tabular-nums text-description text-ink-soft">
                      {option.hint}
                    </span>
                  )}
                  <span className="flex h-3.5 w-3.5 flex-none items-center justify-center">
                    {isSelected && <Icon name="check" className="h-3.5 w-3.5 text-accent" />}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        {actions && actions.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5 border-t border-line pt-1">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  close()
                  action.onSelect()
                }}
                className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-body text-ink-soft transition-colors hover:bg-raised hover:text-ink">
                {action.label}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </>
  )
}

Dropdown.displayName = 'Dropdown'
