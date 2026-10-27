type IconName = 'link' | 'close' | 'arrow-right' | 'arrow-left' | 'alert' | 'sail'

type IconProps = {
  name: IconName
  className?: string
}

const PATHS: Record<IconName, string> = {
  link: 'M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7',
  close: 'm7 7 10 10M17 7 7 17',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  alert:
    'M12 8v5m0 3h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z',
  sail: 'M12 3v13H4L12 3Zm3 4 5 9h-5M3 19c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0',
}

/** 应用壳共用的线性图标，与文章内容样式分开。 */
export const Icon = ({ name, className }: IconProps) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? 'h-4 w-4 flex-none'}>
    <path d={PATHS[name]} />
  </svg>
)

Icon.displayName = 'Icon'
