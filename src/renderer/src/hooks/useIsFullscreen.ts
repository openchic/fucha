import { useEffect, useState } from 'react'

function detect(): boolean {
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true
  return window.innerWidth >= window.screen.width && window.innerHeight >= window.screen.height
}

/** 全屏时交通灯隐藏，界面不再为它们保留左侧留白 */
export function useIsFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(detect)

  useEffect(() => {
    const update = (): void => setFullscreen(detect())
    window.addEventListener('resize', update)
    const media = window.matchMedia('(display-mode: fullscreen)')
    media.addEventListener('change', update)
    return () => {
      window.removeEventListener('resize', update)
      media.removeEventListener('change', update)
    }
  }, [])

  return fullscreen
}
