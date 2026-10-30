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
      <div className="flex-none border-b border-line bg-white pt-15 pb-3">
        <div className="content-column">
          <div className="flex min-h-[36.4px] items-center justify-between gap-4">
            <h1 className="sr-only">正在读取文章</h1>
            <div aria-hidden="true" className="h-3 w-[42%] max-w-[320px] rounded-[4px] bg-line" />
            <button type="button" onClick={onCancel} className="button button-secondary">
              <Icon name="close" />
              取消
            </button>
          </div>
          <p role="status" className="mt-2 flex h-7 items-center">
            <span className="sr-only">{label}，请稍候…</span>
            <span aria-hidden="true" className="h-3 w-28 rounded-[4px] bg-line" />
          </p>
        </div>
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
