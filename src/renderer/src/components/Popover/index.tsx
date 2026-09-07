import type { KeyboardEventHandler, ReactNode, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type PopoverProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 触发按钮：用于外部点击判断与关闭后的焦点回位 */
  anchorRef: RefObject<HTMLElement | null>
  /** 可选定位元素；默认用触发按钮，历史列表可传整行 */
  positionRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  align?: 'start' | 'end'
  id?: string
  role?: 'menu' | 'listbox' | 'dialog'
  ariaLabel?: string
  className?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
  children: ReactNode
}

const GAP = 8
const EXIT_MS = 110

/** 共享弹层：portal、定位、进出场、外部点击与焦点回位 */
export const Popover = (props: PopoverProps) => {
  const {
    open,
    onOpenChange,
    anchorRef,
    positionRef,
    returnFocusRef,
    align = 'end',
    id,
    role,
    ariaLabel,
    className,
    initialFocusRef,
    onKeyDown,
    children,
  } = props
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      return
    }
    if (!mounted) return
    setClosing(true)
    const timer = setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [mounted, open])

  useLayoutEffect(() => {
    if (!mounted) {
      setPosition(null)
      return
    }
    if (!open) return
    const anchor = (positionRef ?? anchorRef).current
    const menu = menuRef.current
    if (!anchor || !menu) return

    const anchorRect = anchor.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    let top = anchorRect.bottom + GAP
    if (top + menuRect.height > window.innerHeight - GAP) {
      top = anchorRect.top - menuRect.height - GAP
    }
    top = Math.max(GAP, Math.min(top, window.innerHeight - menuRect.height - GAP))
    let left = align === 'end' ? anchorRect.right - menuRect.width : anchorRect.left
    left = Math.max(GAP, Math.min(left, window.innerWidth - menuRect.width - GAP))
    setPosition({ top, left })
  }, [align, anchorRef, mounted, open, positionRef])

  useLayoutEffect(() => {
    if (!open || !mounted || !position) return
    const target =
      initialFocusRef?.current ??
      menuRef.current?.querySelector<HTMLElement>(
        'button, [href], input, [role="option"], [role="menuitem"], [tabindex]:not([tabindex="-1"])'
      )
    target?.focus()
  }, [initialFocusRef, mounted, open, position])

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      return
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    ;(returnFocusRef?.current ?? anchorRef.current)?.focus()
  }, [anchorRef, open, returnFocusRef])

  useEffect(() => {
    if (!open) return

    const isInside = (target: EventTarget | null): boolean => {
      const node = target as Node | null
      return Boolean(node && (menuRef.current?.contains(node) || anchorRef.current?.contains(node)))
    }
    const handlePointerDown = (event: PointerEvent): void => {
      if (!isInside(event.target)) onOpenChange(false)
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onOpenChange(false)
    }
    const handleViewportChange = (): void => onOpenChange(false)

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [anchorRef, onOpenChange, open])

  if (!mounted) return null

  const animation = position
    ? closing
      ? 'pointer-events-none animate-popover-out'
      : 'animate-popover-in'
    : ''
  const origin = align === 'end' ? 'origin-top-right' : 'origin-top-left'

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`fixed z-50 rounded-xl border border-line bg-white p-1 shadow-[0_10px_30px_rgba(0,0,0,0.08)] ${origin} ${animation} ${className ?? ''}`}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}>
      {children}
    </div>,
    document.body
  )
}

Popover.displayName = 'Popover'
