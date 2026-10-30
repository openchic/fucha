import type { AppError } from '../../hooks/useArticlePreview'
import { Icon } from '../Icon'

const ERROR_LABEL: Record<AppError['kind'], string> = {
  network: '网络不可达',
  timeout: '请求超时',
  rejected: '目标拒绝',
  captcha: '需要验证',
  extract: '无法提取正文',
}

type ErrorPanelProps = {
  error: AppError
  onRetry: () => void
}

export const ErrorPanel = (props: ErrorPanelProps) => {
  const { error, onRetry } = props
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b border-line bg-white pt-[86px] pb-5">
        <div className="content-column">
          <h1 className="text-[26px] font-semibold leading-[1.4] tracking-[-0.025em] [overflow-wrap:anywhere]">
            {ERROR_LABEL[error.kind]}
          </h1>
        </div>
      </div>
      <div className="reading-viewport min-h-0 flex-1 overflow-y-auto">
        <div className="content-column py-9">
          <div
            className="flex items-start gap-3 rounded-2xl bg-raised p-5 text-body leading-[1.8] [overflow-wrap:anywhere]"
            role="alert">
            <Icon name="alert" className="mt-1 h-4 w-4 flex-none text-danger" />
            <p>{error.message}</p>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="button button-primary mt-6 h-9 px-[18px]">
            重新尝试
            <Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

ErrorPanel.displayName = 'ErrorPanel'
