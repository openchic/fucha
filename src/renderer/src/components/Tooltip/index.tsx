import { type ReactElement, type ReactNode, cloneElement, useId } from 'react'

type TooltipProps = {
  label: ReactNode
  shortcut?: string
  hidden?: boolean
  children: ReactElement<{ 'aria-describedby'?: string }>
}

/** 悬停或键盘聚焦时显示在触发元素下方的提示；鼠标点击不会让提示常驻 */
export const Tooltip = ({ label, shortcut, hidden, children }: TooltipProps) => {
  const id = useId()
  return (
    <span className="group relative flex items-center">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-description leading-5 text-white ${
          hidden
            ? 'hidden'
            : 'opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100'
        }`}>
        {label}
        {shortcut && <span className="ml-1.5 text-white/60">{shortcut}</span>}
      </span>
    </span>
  )
}

Tooltip.displayName = 'Tooltip'
