import { type FormEvent, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Icon } from '../../components'

/** 首页：输入链接后跳到预览页，?url= 用于带回来路链接 */
const Home = () => {
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
    <main className="h-full overflow-y-auto bg-white pt-20 pb-16">
      <div className="flex min-h-full items-center justify-center">
        <div className="content-column pb-6">
          <div className="flex items-center gap-3.5">
            <Icon name="sail" className="h-9 w-9 flex-none text-primary [stroke-width:1.35]" />
            <h1 className="text-[32px] font-semibold leading-[1.3] tracking-[-0.04em]">浮槎</h1>
          </div>
          <p className="mt-4 text-title leading-[1.8] text-ink-soft">
            把一个能公开访问的链接，变成一篇可以直接发进公众号的文章
          </p>
          <div className="mt-9">
            <form onSubmit={handleSubmit} className="w-full min-w-0" noValidate>
              <div
                className={`flex h-14 min-w-0 items-center gap-2.5 rounded-full border bg-white py-1.5 pr-1.5 pl-[18px] transition-colors duration-150 ease-out ${
                  error
                    ? 'border-danger focus-within:border-danger'
                    : 'border-line focus-within:border-primary'
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
                  placeholder="请输入一个链接"
                  aria-invalid={!!error}
                  aria-describedby="home-feedback"
                  className="h-full w-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-ellipsis text-ink placeholder:text-ink-soft focus-visible:outline-none"
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
                <button
                  type="submit"
                  className="button button-primary h-[42px] gap-2.5 px-5 text-body">
                  <span>生成预览</span>
                  <Icon name="arrow-right" />
                </button>
              </div>
              <div
                id="home-feedback"
                className="mt-3 min-h-[22px] pl-[19px] text-secondary leading-[1.7] text-danger">
                {error && <p role="alert">{error}</p>}
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}

Home.displayName = 'Home'

export default Home
