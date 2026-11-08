/**
 * 主进程校验用的内置主题保留 id 与名称；主进程无法引用渲染层预设，
 * 这份契约必须与 renderer/src/theme/presets 保持一致，由 harness 校验。
 */
export const BUILTIN_THEME_CONTRACT: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'default', name: '雾紫' },
  { id: 'shujuan', name: '书卷' },
  { id: 'danxia', name: '苔青' },
]

const builtinIds = BUILTIN_THEME_CONTRACT.map(({ id }) => id.trim())
const builtinNames = BUILTIN_THEME_CONTRACT.map(({ name }) => name.trim())
if (new Set(builtinIds).size !== builtinIds.length) throw new Error('内置主题 id 重复')
if (new Set(builtinNames.map((name) => name.toLowerCase())).size !== builtinNames.length) {
  throw new Error('内置主题名称重复')
}

export const BUILTIN_THEME_IDS: readonly string[] = builtinIds

export const BUILTIN_THEME_NAMES: Record<string, string> = Object.fromEntries(
  BUILTIN_THEME_CONTRACT.map(({ id, name }) => [id.trim(), name.trim()])
)
