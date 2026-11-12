import type { AppError } from '../../hooks'
import { Button } from '../Button'
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
  onCancel?: () => void
}

export const ErrorPanel = (props: ErrorPanelProps) => {
  const { error, onRetry, onCancel } = props
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="content-column">
          <div className="mx-auto flex w-fit max-w-[26rem] items-start gap-3">
            <Icon name="alert" className="mt-2 h-5 w-5 flex-none text-danger" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[26px] leading-[1.4] tracking-[-0.025em] [overflow-wrap:anywhere]">
                {ERROR_LABEL[error.kind]}
              </h1>
              <p
                role="alert"
                className="mt-2 max-w-[38em] text-body leading-[1.8] text-ink-soft [overflow-wrap:anywhere]">
                {error.message}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={onRetry} className="h-9 px-[18px]">
                  重新尝试
                  <Icon name="arrow-right" />
                </Button>
                {onCancel && (
                  <Button variant="secondary" onClick={onCancel} className="h-9 px-[18px]">
                    返回修改链接
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

ErrorPanel.displayName = 'ErrorPanel'
