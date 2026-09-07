import { type FormEvent, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Icon } from '../../components'

/** Home 布局的 index 子路由：默认 New 输入页 */
const New = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [value, setValue] = useState(params.get('url') ?? '')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    const raw = value.trim()

    try {
      const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
      if (
        !/^https?:$/.test(parsed.protocol) ||
        (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') ||
        parsed.username ||
        parsed.password ||
        /\s/.test(raw)
      ) {
        throw new Error('invalid-url')
      }
      setError('')
      navigate(`/preview?url=${encodeURIComponent(parsed.href)}`)
    } catch {
      setError('请输入有效的 HTTP 或 HTTPS 文章链接')
      inputRef.current?.focus()
    }
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="content-column">
          <form onSubmit={handleSubmit} className="w-full min-w-0" noValidate>
            <div
              className={`flex h-14 min-w-0 items-center gap-2.5 rounded-full border bg-white py-1.5 pr-1.5 pl-[18px] transition-colors duration-150 ease-out ${
                error
                  ? 'border-danger focus-within:border-danger'
                  : 'border-line focus-within:border-accent'
              }`}>
              <Icon name="link" className="h-[18px] w-[18px] flex-none text-ink-soft" />
              <input
                ref={inputRef}
                type="text"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                required
                value={value}
                onChange={(event) => {
                  setError('')
                  setValue(event.target.value)
                }}
                aria-label="文章链接"
                placeholder="粘贴文章链接"
                aria-invalid={!!error}
                aria-describedby="new-feedback"
                className="h-full w-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ellipsis text-ink placeholder:text-ink-soft focus-visible:outline-none"
                autoFocus
              />
              {value.length > 0 && (
                <button
                  type="button"
                  aria-label="清除链接"
                  title="清除链接"
                  onClick={() => {
                    setError('')
                    setValue('')
                    inputRef.current?.focus()
                  }}
                  className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-[background-color,transform] duration-150 ease-out hover:bg-raised hover:text-ink active:scale-[0.97]">
                  <Icon name="close" />
                </button>
              )}
              <Button type="submit" variant="primary" className="h-[42px] gap-2.5 px-5 text-body">
                <span>生成预览</span>
                <Icon name="arrow-right" />
              </Button>
            </div>
            <div
              id="new-feedback"
              className="mt-3 min-h-6 pl-[19px] text-body leading-[1.7] text-danger">
              {error && <p role="alert">{error}</p>}
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}

New.displayName = 'New'

export default New
