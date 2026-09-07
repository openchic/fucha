import type { Stage } from '../../hooks'
import './index.css'
import { Button } from '../Button'
import { Icon } from '../Icon'

type LoadingPanelProps = {
  stage: Stage
  onCancel: () => void
}

export const LoadingPanel = (props: LoadingPanelProps) => {
  const { stage, onCancel } = props
  const label = stage === 'request' ? '正在请求' : '正在解析'
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true">
      <div className="relative z-30 flex h-11 flex-none items-center gap-4 bg-white pr-6 pl-[calc(1.5rem+var(--page-header-inset,0px))] transition-[padding-left] duration-200 ease-out">
        <p role="status" className="flex min-w-0 flex-1 items-center">
          <span className="sr-only">{label}，请稍候…</span>
          <span
            aria-hidden="true"
            className="skeleton-bar h-3 w-[42%] max-w-[320px] rounded-[4px]"
          />
        </p>
        <div className="no-drag flex items-center gap-3" aria-hidden="true">
          <div className="skeleton-bar h-3 w-40 rounded-[4px]" />
          <div className="skeleton-bar h-3 w-16 rounded-[4px]" />
        </div>
        <Button
          variant="secondary"
          onClick={onCancel}
          className="no-drag h-7 gap-1.5 px-2.5 text-description">
          <Icon name="close" className="h-3.5 w-3.5 flex-none" />
          取消
        </Button>
      </div>
      <div className="reading-viewport min-h-0 flex-1 overflow-y-auto">
        <div className="content-column py-10" aria-hidden="true">
          <div className="skeleton-bar mb-7 h-[22px] w-[42%] rounded-[4px]" />
          <div className="mb-8 grid gap-4">
            {[96, 100, 93, 100, 76].map((width, index) => (
              <div
                key={index}
                className="skeleton-bar h-3 rounded-[4px]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
          <div className="mb-8 grid gap-4">
            {[100, 91, 98, 65].map((width, index) => (
              <div
                key={index}
                className="skeleton-bar h-3 rounded-[4px]"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

LoadingPanel.displayName = 'LoadingPanel'
