import type { Stage } from '../../hooks'
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
      <div className="drag-region relative z-30 flex h-11 flex-none items-center gap-4 bg-white px-6">
        <p role="status" className="flex min-w-0 flex-1 items-center">
          <span className="sr-only">{label}，请稍候…</span>
          <span aria-hidden="true" className="h-3 w-[42%] max-w-[320px] rounded-[4px] bg-line" />
        </p>
        <div className="no-drag flex items-center gap-3" aria-hidden="true">
          <div className="h-3 w-40 rounded-[4px] bg-line" />
          <div className="h-3 w-16 rounded-[4px] bg-line" />
        </div>
        <button type="button" onClick={onCancel} className="button button-secondary no-drag">
          <Icon name="close" />
          取消
        </button>
      </div>
      <div className="reading-viewport min-h-0 flex-1 overflow-y-auto">
        <div className="content-column py-10" aria-hidden="true">
          <div className="mb-7 h-[22px] w-[42%] rounded-[4px] bg-line" />
          <div className="mb-8 grid gap-4">
            {[96, 100, 93, 100, 76].map((width, index) => (
              <div
                key={index}
                className="h-3 rounded-[4px] bg-line"
                style={{ width: `${width}%` }}
              />
            ))}
          </div>
          <div className="mb-8 grid gap-4">
            {[100, 91, 98, 65].map((width, index) => (
              <div
                key={index}
                className="h-3 rounded-[4px] bg-line"
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
