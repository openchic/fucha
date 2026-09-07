type WorkArea = {
  width: number
  height: number
}

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800

export function fitWindowSize(workArea: WorkArea): WorkArea {
  return {
    width: Math.min(DEFAULT_WIDTH, workArea.width),
    height: Math.min(DEFAULT_HEIGHT, workArea.height),
  }
}
