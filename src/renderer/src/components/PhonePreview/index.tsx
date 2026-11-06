import type { CSSProperties, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dropdown } from '../Dropdown'

function statusTime(): string {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  })
}

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
  const [time, setTime] = useState(statusTime)
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null)
  const [ready, setReady] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const device = PREVIEW_DEVICES.find((item) => item.value === deviceValue) ?? PREVIEW_DEVICES[0]
  const frameWidth = device.width + 8
  const frameHeight = device.height + 8
  const scale = stageSize
    ? Math.min(
        Math.max(0, (stageSize.width - 48) / frameWidth),
        Math.max(0, (stageSize.height - 88) / frameHeight),
        1
      )
    : 1

  useEffect(() => {
    const timer = window.setInterval(() => setTime(statusTime()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = (): void =>
      setStageSize({ width: stage.clientWidth, height: stage.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      aria-label={ariaLabel}
      className={`relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-white ${className ?? ''}`}>
      <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center gap-3 px-6 pt-3">
        {title && (
          <h2 title={title} className="min-w-0 truncate text-body text-ink">
            {title}
          </h2>
        )}
        <div className="ml-auto flex-none">
          <Dropdown
            label="预览设备"
            value={device.value}
            options={PREVIEW_DEVICES}
            onChange={setDeviceValue}
          />
        </div>
      </div>
      <div
        ref={stageRef}
        className="flex min-h-0 flex-1 items-start justify-center px-6 pb-6 pt-16">
        <div
          className={`relative ${ready ? 'transition-[width,height] duration-200 ease-out' : ''}`}
          style={{ width: frameWidth * scale, height: frameHeight * scale }}>
          <div
            style={
              {
                width: frameWidth,
                height: frameHeight,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                ...variables,
              } as CSSProperties
            }
            className={`relative flex flex-none flex-col rounded-[52px] bg-[#161618] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_28px_56px_-28px_rgba(29,29,31,0.3)] ring-1 ring-white/25 ${
              ready ? 'transition-[width,height,transform] duration-200 ease-out' : ''
            }`}>
            <span
              aria-hidden="true"
              className="absolute top-[80px] -left-[3px] h-[14px] w-[3px] rounded-l-[2px] bg-[#161618]"
            />
            <span
              aria-hidden="true"
              className="absolute top-[104px] -left-[3px] h-[26px] w-[3px] rounded-l-[2px] bg-[#161618]"
            />
            <span
              aria-hidden="true"
              className="absolute top-[140px] -left-[3px] h-[40px] w-[3px] rounded-l-[2px] bg-[#161618]"
            />
            <span
              aria-hidden="true"
              className="absolute top-[116px] -right-[3px] h-[48px] w-[3px] rounded-r-[2px] bg-[#161618]"
            />
            <style dangerouslySetInnerHTML={{ __html: styleCss }} />
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[48px] bg-white">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between px-6 text-ink">
                <span className="text-body font-semibold tracking-[-0.01em]">{time}</span>
                <span className="flex items-center gap-1.5">
                  <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
                    <rect x="0" y="7" width="3.4" height="5" rx="1.2" />
                    <rect x="4.6" y="4.5" width="3.4" height="7.5" rx="1.2" />
                    <rect x="9.2" y="2" width="3.4" height="10" rx="1.2" />
                    <rect x="13.8" y="0" width="3.4" height="12" rx="1.2" />
                  </svg>
                  <svg
                    width="19"
                    height="12"
                    viewBox="0 0 19 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round">
                    <path d="M2.2 4a10.4 10.4 0 0 1 14.6 0" />
                    <path d="M5.2 6.9a6.2 6.2 0 0 1 8.6 0" />
                    <path d="M8.2 9.8a2 2 0 0 1 2.6 0" />
                    <circle cx="9.5" cy="11" r="1" fill="currentColor" stroke="none" />
                  </svg>
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none">
                    <g transform="translate(0 0.5)">
                      <rect
                        x="0.5"
                        y="0.5"
                        width="18"
                        height="11"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                      <rect
                        x="1.1"
                        y="1.1"
                        width="16.8"
                        height="9.8"
                        rx="2.4"
                        fill="currentColor"
                      />
                      <path d="M20 3.7v4.6a2.3 2.3 0 0 0 0-4.6Z" fill="currentColor" />
                    </g>
                  </svg>
                </span>
              </div>
              <div
                aria-hidden="true"
                className="absolute top-[10px] left-1/2 z-10 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-[#161618]">
                <span className="absolute top-1/2 right-[10px] flex h-[12px] w-[12px] -translate-y-1/2 items-center justify-center rounded-full bg-[#0b0c0e] ring-1 ring-[#4a4e56]">
                  <span className="h-[5px] w-[5px] rounded-full bg-[#223b63]" />
                </span>
                <span className="absolute top-1/2 right-[26px] h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-[#23252a]" />
              </div>
              <div className="h-14 flex-none" />
              <div className="min-h-0 flex-1 overflow-y-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {/* html 已在提取或快照读取时经白名单净化 */}
                <div
                  ref={bodyRef}
                  className="article-body"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[7px] left-1/2 z-10 h-[4px] w-[116px] -translate-x-1/2 rounded-full bg-[#161618]/80"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

PhonePreview.displayName = 'PhonePreview'
