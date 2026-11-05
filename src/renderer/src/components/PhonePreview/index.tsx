import type { CSSProperties, RefObject } from 'react'
import { useState } from 'react'
import { Dropdown } from '../Dropdown'

type PreviewDevice = {
  value: string
  label: string
  hint: string
  width: number
  height: number
}

const PREVIEW_DEVICES: PreviewDevice[] = [
  { value: 'iphone-18-pro', label: 'iPhone 18 Pro', hint: '402 × 874', width: 402, height: 874 },
  { value: 'iphone-16', label: 'iPhone 16', hint: '393 × 852', width: 393, height: 852 },
  { value: 'iphone-se', label: 'iPhone SE', hint: '375 × 667', width: 375, height: 667 },
  { value: 'pixel-7', label: 'Pixel 7', hint: '412 × 915', width: 412, height: 915 },
  { value: 'galaxy-s21', label: 'Galaxy S21', hint: '360 × 800', width: 360, height: 800 },
]

type PhonePreviewProps = {
  styleCss: string
  html: string
  bodyRef?: RefObject<HTMLDivElement | null>
  variables?: Record<string, string>
  title?: string
  ariaLabel?: string
  className?: string
}

/** 手机预览面板：设备选择、圆角画布与正文滚动区；主题示例预览与文章预览共用 */
export const PhonePreview = (props: PhonePreviewProps) => {
  const { styleCss, html, bodyRef, variables, title, ariaLabel = '手机预览', className } = props
  const [deviceValue, setDeviceValue] = useState(PREVIEW_DEVICES[0].value)
  const device = PREVIEW_DEVICES.find((item) => item.value === deviceValue) ?? PREVIEW_DEVICES[0]

  return (
    <section
      aria-label={ariaLabel}
      className={`relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-raised ${className ?? ''}`}>
      <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center gap-3 px-6 pt-3">
        {title && <h2 className="min-w-0 truncate text-body text-ink">{title}</h2>}
        <div className="ml-auto flex-none">
          <Dropdown
            label="预览设备"
            value={deviceValue}
            options={PREVIEW_DEVICES}
            onChange={setDeviceValue}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center px-6 pb-6 pt-16">
        <div
          style={
            {
              width: `min(${device.width}px, 100%)`,
              height: `min(${device.height}px, 100%)`,
              ...variables,
            } as CSSProperties
          }
          className="flex flex-col overflow-hidden rounded-[28px] border border-line bg-white transition-[width,height] duration-200 ease-out">
          <style dangerouslySetInnerHTML={{ __html: styleCss }} />
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* html 已在提取或快照读取时经白名单净化 */}
            <div
              ref={bodyRef}
              className="article-body"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

PhonePreview.displayName = 'PhonePreview'
