import type { CheckGroup, CheckResult } from './checks/renderer'
import { runChecks } from './checks/renderer'

declare global {
  interface Window {
    __fuchaChecks: { run: (groups: CheckGroup[]) => CheckResult[] }
  }
}

window.__fuchaChecks = { run: runChecks }
