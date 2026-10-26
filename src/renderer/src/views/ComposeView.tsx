import { type FormEvent, useRef, useState } from 'react'
import { Icon } from '../components'

interface ComposeViewProps {
  url: string
  onUrlChange: (url: string) => void
  onSubmit: (url: string) => void
  disabled?: boolean
}

const ComposeView = (props: ComposeViewProps) => {
  const { url, onUrlChange, onSubmit, disabled } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (disabled || !url.trim()) return

    try {
      const value = url.trim()
      const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`)
      if (
        !/^https?:$/.test(parsed.protocol) ||
        (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') ||
        parsed.username ||
        parsed.password ||
        /\s/.test(value)
      ) {
        throw new Error('invalid-url')
      }
      setError('')
      onSubmit(parsed.href)
    } catch {
      setError('请输入有效的 HTTP 或 HTTPS 文章链接')
      inputRef.current?.focus()
    }
  }

  return (
    <div className="compose-content no-drag content-column">
      <div className="brand-lockup">
        <Icon name="sail" className="brand-mark" />
        <h1>浮槎</h1>
      </div>
      <p className="compose-description">把一个链接，变成一篇可以直接发进公众号的文章</p>
      <div className="compose-form">
        <form onSubmit={handleSubmit} className="url-form" noValidate>
          <label htmlFor="compose-input" className="field-label">
            文章链接
          </label>
          <div className={`field-shell${error ? ' field-shell-invalid' : ''}`}>
            <Icon name="link" className="field-icon" />
            <input
              ref={inputRef}
              id="compose-input"
              type="text"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              required
              value={url}
              onChange={(event) => {
                setError('')
                onUrlChange(event.target.value)
              }}
              placeholder="请输入一个链接"
              disabled={disabled}
              aria-invalid={!!error}
              aria-describedby="compose-feedback"
              autoFocus
            />
            {url.length > 0 && (
              <button
                type="button"
                className="clear-button"
                aria-label="清除链接"
                title="清除链接"
                disabled={disabled}
                onClick={() => {
                  setError('')
                  onUrlChange('')
                  inputRef.current?.focus()
                }}>
                <Icon name="close" />
              </button>
            )}
            <button
              type="submit"
              disabled={disabled || !url.trim()}
              className="button button-primary generate-button">
              <span>生成预览</span>
              <Icon name="arrow-right" />
            </button>
          </div>
          <div id="compose-feedback" className={`form-feedback${error ? ' form-error' : ''}`}>
            <p role={error ? 'alert' : undefined}>{error || '链接需要能被公开访问'}</p>
            {!error && (
              <span className="keyboard-hint">
                回车生成 <span aria-hidden="true">↵</span>
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

ComposeView.displayName = 'ComposeView'

export default ComposeView
