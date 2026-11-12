import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '@renderer/theme/presets'
import { buildThemePackage, parseThemePackage } from '../../src/main/theme-package'
import { createZip, readZip } from '../../src/main/zip'

function customToken() {
  return {
    ...structuredClone(DEFAULT_THEME.token),
    id: 'custom-a',
    name: '自定义甲',
    builtin: false,
  }
}

function packageJson(overrides: Record<string, unknown> = {}) {
  const token = customToken()
  return JSON.stringify({
    id: token.id,
    name: token.name,
    version: '1.0.0',
    tokenVersion: 1,
    token,
    ...overrides,
  })
}

function zipPackage(files: Record<string, string>): Buffer {
  return createZip(Object.entries(files).map(([name, data]) => ({ name, data: Buffer.from(data) })))
}

describe('buildThemePackage', () => {
  it('生成包含 theme.json 与 theme.css 的包', () => {
    const zip = buildThemePackage({ token: customToken(), css: 'h1 { color: red; }' })
    const entries = readZip(zip)
    expect([...entries.keys()].sort()).toEqual(['theme.css', 'theme.json'])
    expect(entries.get('theme.css')?.toString('utf8')).toBe('h1 { color: red; }')
  })

  it('内置主题导出后变为自定义主题', () => {
    const zip = buildThemePackage({ token: structuredClone(DEFAULT_THEME.token), css: '' })
    expect(parseThemePackage(zip).token.builtin).toBe(false)
  })

  it('拒绝非法 CSS', () => {
    expect(() =>
      buildThemePackage({ token: customToken(), css: 'h1 { position: fixed; }' })
    ).toThrow('使用了微信不支持的属性')
  })

  it('拒绝不支持的主题版本', () => {
    expect(() => buildThemePackage({ token: customToken(), css: '', tokenVersion: 2 })).toThrow(
      '不支持的主题 token 版本'
    )
  })
})

describe('parseThemePackage', () => {
  it('往返保持一致', () => {
    const token = customToken()
    const css = 'h1 { color: var(--theme-primary); }'
    const parsed = parseThemePackage(buildThemePackage({ token, css }))
    expect(parsed.token).toEqual(token)
    expect(parsed.css).toBe(css)
    expect(parsed.tokenVersion).toBe(1)
  })

  it('拒绝多余文件', () => {
    const zip = zipPackage({ 'theme.json': packageJson(), 'theme.css': '', 'extra.txt': 'x' })
    expect(() => parseThemePackage(zip)).toThrow('主题包包含多余文件')
  })

  it('缺少 theme.css 或 theme.json 时拒绝', () => {
    expect(() => parseThemePackage(zipPackage({ 'theme.json': packageJson() }))).toThrow(
      '主题包缺少 theme.css'
    )
    expect(() => parseThemePackage(zipPackage({ 'theme.css': '' }))).toThrow(
      '主题包缺少 theme.json'
    )
  })

  it('拒绝非法 JSON', () => {
    expect(() => parseThemePackage(zipPackage({ 'theme.json': '{', 'theme.css': '' }))).toThrow(
      'theme.json 不是合法 JSON'
    )
  })

  it('拒绝非对象 JSON', () => {
    expect(() => parseThemePackage(zipPackage({ 'theme.json': '[]', 'theme.css': '' }))).toThrow(
      'theme.json 必须是对象'
    )
  })

  it('拒绝 id 与 token.id 不一致', () => {
    const zip = zipPackage({ 'theme.json': packageJson({ id: 'other' }), 'theme.css': '' })
    expect(() => parseThemePackage(zip)).toThrow('theme.json 的 id 与 token.id 不一致')
  })

  it('拒绝 name 与 token.name 不一致', () => {
    const zip = zipPackage({ 'theme.json': packageJson({ name: '别的名字' }), 'theme.css': '' })
    expect(() => parseThemePackage(zip)).toThrow('theme.json 的 name 与 token.name 不一致')
  })

  it('拒绝声明为内置主题的包', () => {
    const token = { ...customToken(), builtin: true }
    const zip = zipPackage({ 'theme.json': packageJson({ token }), 'theme.css': '' })
    expect(() => parseThemePackage(zip)).toThrow('主题包不能声明为内置主题')
  })

  it('拒绝缺少版本或版本不符', () => {
    expect(() =>
      parseThemePackage(zipPackage({ 'theme.json': packageJson({ version: '' }), 'theme.css': '' }))
    ).toThrow('theme.json 缺少 version')
    expect(() =>
      parseThemePackage(
        zipPackage({ 'theme.json': packageJson({ tokenVersion: 2 }), 'theme.css': '' })
      )
    ).toThrow('不支持的主题 token 版本')
  })

  it('拒绝包内非法 CSS', () => {
    const zip = zipPackage({ 'theme.json': packageJson(), 'theme.css': 'h1 { float: left; }' })
    expect(() => parseThemePackage(zip)).toThrow('使用了微信不支持的属性')
  })

  it('拒绝损坏的 zip', () => {
    expect(() => parseThemePackage(Buffer.from('not a zip at all, but long enough'))).toThrow(
      '不是有效的 zip 文件'
    )
  })
})
