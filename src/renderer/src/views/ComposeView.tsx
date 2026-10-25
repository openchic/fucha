import { type FormEvent, useCallback } from 'react'

interface ComposeViewProps {
  url: string
  onUrlChange: (url: string) => void
  onSubmit: (url: string) => void
  disabled?: boolean
}

interface UrlFormProps extends ComposeViewProps {
  id: string
  compact?: boolean
}

export function UrlForm({
  id,
  url,
  onUrlChange,
  onSubmit,
  disabled,
  compact = false,
}: UrlFormProps) {
  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      if (!disabled) onSubmit(url)
    },
    [disabled, onSubmit, url]
  )

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? 'flex min-w-0 flex-1 items-center gap-2' : 'w-full'}>
      <label
        htmlFor={id}
        className={compact ? 'sr-only' : 'mb-2 block text-body font-medium text-ink'}>
        文章链接
      </label>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          id={id}
          type="url"
          required
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="请输入一个链接"
          disabled={disabled}
          className={
            compact
              ? 'h-9 min-w-0 flex-1 rounded-control border border-shell-border bg-shell-raised px-3 text-secondary text-shell-text placeholder:text-shell-muted focus:border-primary disabled:opacity-50'
              : 'h-11 min-w-0 flex-1 rounded-control border border-line bg-white px-3 text-body text-ink placeholder:text-ink-soft focus:border-primary disabled:opacity-50'
          }
          autoFocus={!compact}
        />
        <button
          type="submit"
          disabled={disabled || !url.trim()}
          className={
            compact
              ? 'h-9 shrink-0 rounded-control border border-shell-border bg-shell-raised px-4 text-secondary font-medium text-shell-text transition-opacity duration-200 hover:not-disabled:opacity-80 disabled:cursor-not-allowed disabled:opacity-35'
              : 'h-11 shrink-0 rounded-control bg-primary px-5 text-body font-medium text-primary-ink transition-opacity duration-200 hover:not-disabled:opacity-85 disabled:cursor-not-allowed disabled:opacity-40'
          }>
          生成
        </button>
      </div>
    </form>
  )
}

export default function ComposeView(props: ComposeViewProps) {
  return (
    <div className="mx-auto w-full max-w-[40rem] px-8 pt-[18vh]">
      <h1 className="text-[1.5rem] font-medium tracking-tight text-ink">从链接开始</h1>
      <p className="mt-2 text-body text-ink-soft">把一个链接，变成一篇可以直接发进公众号的文章</p>
      <div className="mt-8">
        <UrlForm {...props} id="compose-url" />
      </div>
    </div>
  )
}
