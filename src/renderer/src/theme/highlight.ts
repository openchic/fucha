import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import {
  ATOM_ONE_LIGHT_HIGHLIGHT_BACKGROUND,
  ATOM_ONE_LIGHT_HIGHLIGHT_CSS,
} from './hljs-atom-one-light'
import { GITHUB_HIGHLIGHT_BACKGROUND, GITHUB_HIGHLIGHT_CSS } from './hljs-github'
import { XCODE_HIGHLIGHT_BACKGROUND, XCODE_HIGHLIGHT_CSS } from './hljs-xcode'

const LANGUAGES = [
  ['javascript', javascript],
  ['js', javascript],
  ['typescript', typescript],
  ['ts', typescript],
  ['python', python],
  ['py', python],
  ['go', go],
  ['rust', rust],
  ['bash', bash],
  ['sh', bash],
  ['shell', bash],
  ['json', json],
  ['yaml', yaml],
  ['yml', yaml],
  ['xml', xml],
  ['html', xml],
  ['css', css],
  ['sql', sql],
] as const

for (const [name, language] of LANGUAGES) {
  hljs.registerLanguage(name, language)
}

/** hljs 主题自带背景会与代码块 surface 冲突，只保留语法色 */
function stripBackground(cssText: string): string {
  return cssText.replace(/background(?:-color)?\s*:\s*[^;}]+;?/gi, '')
}

const THEME_CSS: Record<string, string> = {
  github: stripBackground(GITHUB_HIGHLIGHT_CSS),
  'atom-one-light': stripBackground(ATOM_ONE_LIGHT_HIGHLIGHT_CSS),
  xcode: stripBackground(XCODE_HIGHLIGHT_CSS),
}

const THEME_BACKGROUNDS: Record<string, string> = {
  github: GITHUB_HIGHLIGHT_BACKGROUND,
  'atom-one-light': ATOM_ONE_LIGHT_HIGHLIGHT_BACKGROUND,
  xcode: XCODE_HIGHLIGHT_BACKGROUND,
}

/** 代码块背景由语法主题决定；未知主题回落 github */
export function highlightThemeBackground(name: string): string {
  return THEME_BACKGROUNDS[name] ?? THEME_BACKGROUNDS.github!
}

/** 语法主题只提供 github / atom-one-light / xcode；未知主题回落 github，避免导出无声缺色 */
export function highlightThemeCss(name: string): string {
  return THEME_CSS[name] ?? THEME_CSS.github!
}

function languageOf(code: Element): string | undefined {
  const match = /(?:^|\s)(?:language|lang)-([\w-]+)/i.exec(code.getAttribute('class') ?? '')
  if (!match) return undefined
  const name = match[1]!.toLowerCase()
  return hljs.getLanguage(name) ? name : undefined
}

/** 对正文代码块做语法高亮；显式语言优先，缺省走已注册语言自动检测 */
export function highlightArticleHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('pre code').forEach((code) => {
    const source = code.textContent ?? ''
    if (!source.trim()) return
    const language = languageOf(code)
    const result = language
      ? hljs.highlight(source, { language, ignoreIllegals: true })
      : hljs.highlightAuto(source)
    if (!language && (!result.language || result.relevance <= 0)) return
    code.innerHTML = result.value
    code.classList.add('hljs')
    if (result.language) code.classList.add(`language-${result.language}`)
  })
  return doc.body.innerHTML
}
