import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmContext, type ConfirmOptions } from '../../hooks/useConfirm'

type PendingConfirm = {
  id: number
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

let nextId = 0
const EXIT_MS = 110

type ConfirmDialogProps = {
  options: ConfirmOptions
  onSettle: (confirmed: boolean) => void
}

const ConfirmDialog = ({ options, onSettle }: ConfirmDialogProps) => {
  const {
    title,
    description,
    confirmLabel = '确定',
    cancelLabel = '取消',
    tone = 'primary',
  } = options
  const titleId = useId()
  const descriptionId = useId()
  const [closing, setClosing] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const settled = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const finish = useCallback(
    (confirmed: boolean): void => {
      if (settled.current) return
      settled.current = true
      setClosing(true)
      closeTimer.current = setTimeout(() => onSettle(confirmed), EXIT_MS)
    },
    [onSettle]
  )

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    return () => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus()
    }
  }, [])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      finish(false)
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [finish])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Tab') return
    const focusables = [cancelRef.current, confirmRef.current].filter(
      (node): node is HTMLButtonElement => Boolean(node)
    )
    if (focusables.length === 0) return
    const currentIndex = focusables.indexOf(document.activeElement as HTMLButtonElement)
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusables.length - 1
        : currentIndex - 1
      : (currentIndex + 1) % focusables.length
    event.preventDefault()
    focusables[nextIndex]?.focus()
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-ink/20 p-6 backdrop-blur-[4px] ${
        closing ? 'animate-fade-out pointer-events-none' : 'animate-fade-in'
      }`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) finish(false)
      }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={handleKeyDown}
        className={`max-h-[80vh] w-full max-w-[420px] overflow-y-auto rounded-2xl border border-line bg-white p-5 ${
          closing ? 'animate-popover-out' : 'animate-popover-in'
        }`}>
        <h2 id={titleId} className="text-title font-semibold text-ink">
          {title}
        </h2>
        {description && (
          <p
            id={descriptionId}
            className="mt-2 text-secondary leading-[1.7] break-words text-ink-soft">
            {description}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => finish(false)}
            className="button button-secondary h-8 px-4">
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => finish(true)}
            className={`button h-8 px-4 ${tone === 'danger' ? 'button-danger' : 'button-primary'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

ConfirmDialog.displayName = 'ConfirmDialog'

type ConfirmProviderProps = {
  children: ReactNode
}

export const ConfirmProvider = ({ children }: ConfirmProviderProps) => {
  const queue = useRef<PendingConfirm[]>([])
  const [current, setCurrent] = useState<PendingConfirm | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      queue.current.push({ id: nextId++, options, resolve })
      setCurrent((head) => head ?? queue.current[0])
    })
  }, [])

  const settle = useCallback((confirmed: boolean): void => {
    const [head, ...rest] = queue.current
    queue.current = rest
    head?.resolve(confirmed)
    setCurrent(rest[0] ?? null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && <ConfirmDialog key={current.id} options={current.options} onSettle={settle} />}
    </ConfirmContext.Provider>
  )
}

ConfirmProvider.displayName = 'ConfirmProvider'
