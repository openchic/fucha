import type { Stage } from '../../hooks/useArticlePreview'
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
      <div className="flex-none border-b border-line bg-white pt-9 pb-5 drag-region">
        <div className="content-column">
          <div className="mb-4.5 flex h-8 items-center justify-between gap-4">
            <span className="text-body font-medium text-ink-soft">浮槎</span>
            <button type="button" onClick={onCancel} className="button button-secondary">
              <Icon name="close" />
              取消
            </button>
          </div>
          <h1 className="text-[26px] font-semibold leading-[1.4] tracking-[-0.025em] [overflow-wrap:anywhere]">
            正在读取文章
          </h1>
          <p role="status" className="mt-3 text-secondary leading-[1.6] text-ink-soft">
            {label}，请稍候…
          </p>
        </div>
      </div>
      <div className="reading-viewport min-h-0 flex-1 overflow-y-auto">
        <div className="content-column py-9" aria-hidden="true">
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
