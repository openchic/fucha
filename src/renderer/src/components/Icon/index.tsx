type IconName =
  | 'link'
  | 'close'
  | 'arrow-right'
  | 'arrow-left'
  | 'refresh'
  | 'reset'
  | 'alert'
  | 'sail'
  | 'copy'
  | 'chevron-down'
  | 'check'
  | 'edit'
  | 'plus'
  | 'minus'
  | 'external-link'
  | 'more'
  | 'settings'
  | 'smartphone'

type IconProps = {
  name: IconName
  className?: string
}

const PATHS: Record<IconName, string> = {
  link: 'M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7',
  close: 'm7 7 10 10M17 7 7 17',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  refresh: 'M20 11a8 8 0 0 0-15.5-2M4 4v5h5M4 13a8 8 0 0 0 15.5 2M20 20v-5h-5',
  reset: 'M1 4v6h6M3.51 15a9 9 0 1 0 2.13-9.36L1 10',
  alert:
    'M12 8v5m0 3h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z',
  sail: 'M12 3v13H4L12 3Zm3 4 5 9h-5M3 19c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  'chevron-down': 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  'external-link': 'M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  settings:
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  smartphone:
    'M6 2.5h12a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z M10 18.5h4',
}

/** 点状图标的笔画就是点径，需要比线图标更粗才看得清 */
const STROKE_WIDTHS: Partial<Record<IconName, number>> = {
  more: 3,
}

/** 应用壳共用的线性图标，与文章内容样式分开。 */
export const Icon = ({ name, className }: IconProps) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={STROKE_WIDTHS[name] ?? 1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className ?? 'h-4 w-4 flex-none'}>
    <path d={PATHS[name]} />
  </svg>
)

Icon.displayName = 'Icon'
