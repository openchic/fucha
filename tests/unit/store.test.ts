import type { Article } from '@shared/types'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEME } from '@renderer/theme/presets'
import {
  closeLocalStore,
  getLocalStoreStatus,
  initLocalStore,
  LOCAL_STORE_SCHEMA_VERSION,
  MIGRATIONS,
} from '../../src/main/db'
import {
  clearHistory,
  createTheme,
  deleteArticle,
  deleteTheme,
  getArticle,
  getPreference,
  getTheme,
  listArticles,
  listThemes,
  replaceArticleImages,
  setArticleTheme,
  setPreference,
  touchArticle,
  updateTheme,
  upsertArticle,
} from '../../src/main/store'

let dir = ''
let dbPath = ''

function customToken(id = 'custom-a', name = '自定义甲') {
  return { ...structuredClone(DEFAULT_THEME.token), id, name, builtin: false }
}

function article(overrides: Partial<Article> = {}): Article {
  return {
    title: '文章标题',
    sourceUrl: 'https://example.com/a',
    html: '<p>正文</p>',
    images: [],
    ...overrides,
  }
}

function save(hash: string, options: { themeId?: string; title?: string } = {}) {
  return upsertArticle({
    hash,
    finalUrl: `https://example.com/${hash}`,
    article: article({ title: options.title ?? `文章 ${hash.slice(0, 4)}` }),
    images: [
      {
        id: 'img-1',
        originalUrl: 'https://example.com/1.png',
        status: 'done',
        width: 10,
        height: 20,
      },
      { id: 'img-2', originalUrl: 'https://example.com/2.png', status: 'pending' },
    ],
    themeId: options.themeId,
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function createLegacyDb(path: string, version: number, seed?: (db: DatabaseSync) => void) {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  for (const migration of MIGRATIONS) {
    if (migration.version > version) break
    db.exec(migration.sql)
    db.exec(`PRAGMA user_version = ${migration.version}`)
  }
  seed?.(db)
  db.close()
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fucha-store-'))
  dbPath = join(dir, 'app.db')
})

afterEach(async () => {
  closeLocalStore()
  await rm(dir, { recursive: true, force: true })
})

describe('数据库初始化', () => {
  it('首次初始化建库并可读写', () => {
    const status = initLocalStore(dbPath)
    expect(status.available).toBe(true)
    expect(getLocalStoreStatus().available).toBe(true)
    setPreference('theme.active', 'default')
    expect(getPreference('theme.active')).toBe('default')
  })

  it('schema 版本为当前值且索引齐全', () => {
    initLocalStore(dbPath)
    const db = new DatabaseSync(dbPath)
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number }
    expect(version.user_version).toBe(LOCAL_STORE_SCHEMA_VERSION)

    const indexes = (
      db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all() as {
        name: string
      }[]
    ).map((row) => row.name)
    expect(indexes).toEqual(
      expect.arrayContaining(['articles_updated_idx', 'themes_sort_idx', 'themes_name_idx'])
    )
    expect(indexes).not.toContain('articles_activity_idx')
    expect(indexes).not.toContain('articles_final_url_idx')

    const plan = db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT hash FROM articles ORDER BY updated_at DESC, created_at DESC LIMIT 50 OFFSET 0'
      )
      .all()
    expect(JSON.stringify(plan)).toContain('articles_updated_idx')
    db.close()
  })

  it('重复初始化保留已有数据', () => {
    initLocalStore(dbPath)
    setPreference('theme.active', 'custom')
    closeLocalStore()

    expect(initLocalStore(dbPath).available).toBe(true)
    expect(getPreference('theme.active')).toBe('custom')
  })

  it('版本高于代码支持时降级为不可用', async () => {
    const db = new DatabaseSync(dbPath)
    db.exec('PRAGMA user_version = 99')
    db.close()

    expect(initLocalStore(dbPath).available).toBe(false)
    expect(getLocalStoreStatus().error).toContain('高于代码支持')
  })

  it('损坏的数据库文件降级为不可用', async () => {
    await writeFile(dbPath, 'not a sqlite database')
    expect(initLocalStore(dbPath).available).toBe(false)
  })

  it('存储不可用时读写抛出明确错误', async () => {
    await writeFile(dbPath, 'broken')
    initLocalStore(dbPath)
    expect(() => getPreference('x')).toThrow('本地数据库不可用')
  })
})

describe('历史版本迁移', () => {
  it('v6 把 serif 映射为 shujuan 并更新偏好', async () => {
    await createLegacyDb(dbPath, 6, (db) => {
      db.prepare(
        `INSERT INTO themes (id, name, token, css, token_version, source_theme_id, sort, created_at, updated_at)
         VALUES ('derived', '派生', ?, '', 1, 'serif', 0, '2026-01-01', '2026-01-01')`
      ).run(JSON.stringify(customToken('derived', '派生')))
      db.prepare(
        `INSERT INTO articles (hash, source_url, final_url, theme_id, title, html, created_at, updated_at, visit_count)
         VALUES (?, ?, ?, 'serif', '书卷文章', '<p>x</p>', '2026-01-01', '2026-01-01', 0)`
      ).run('b'.repeat(32), 'https://e.test/b', 'https://e.test/b')
      db.prepare(
        `INSERT INTO preferences (key, value, updated_at) VALUES ('theme.active', '"serif"', '2026-01-01')`
      ).run()
    })
    expect(initLocalStore(dbPath).available).toBe(true)
    expect(getArticle('b'.repeat(32))?.themeId).toBe('shujuan')
    expect(getTheme('derived')?.sourceThemeId).toBe('shujuan')
    expect(getPreference('theme.active')).toBe('shujuan')
  })

  it('v7 清理 xueqing 中间主题 id', async () => {
    await createLegacyDb(dbPath, 7, (db) => {
      db.prepare(
        `INSERT INTO articles (hash, source_url, final_url, theme_id, title, html, created_at, updated_at, visit_count)
         VALUES (?, ?, ?, 'xueqing', '旧文章', '<p>x</p>', '2026-01-01', '2026-01-01', 0)`
      ).run('c'.repeat(32), 'https://e.test/c', 'https://e.test/c')
    })
    initLocalStore(dbPath)
    expect(getArticle('c'.repeat(32))?.themeId).toBe('default')
  })

  it('v9 把 danxia 统一为 qingci', async () => {
    await createLegacyDb(dbPath, 8, (db) => {
      db.prepare(
        `INSERT INTO articles (hash, source_url, final_url, theme_id, title, html, created_at, updated_at, visit_count)
         VALUES (?, ?, ?, 'danxia', '旧文章', '<p>x</p>', '2026-01-01', '2026-01-01', 0)`
      ).run('a'.repeat(32), 'https://e.test/a', 'https://e.test/a')
      db.prepare(
        `INSERT INTO themes (id, name, token, css, token_version, source_theme_id, sort, created_at, updated_at)
         VALUES ('legacy', '旧主题', ?, '', 1, 'danxia', 0, '2026-01-01', '2026-01-01')`
      ).run(JSON.stringify(customToken('legacy', '旧主题')))
      db.prepare(
        `INSERT INTO preferences (key, value, updated_at) VALUES ('theme.active', '"danxia"', '2026-01-01')`
      ).run()
    })
    initLocalStore(dbPath)
    expect(getArticle('a'.repeat(32))?.themeId).toBe('qingci')
    expect(getTheme('legacy')?.sourceThemeId).toBe('qingci')
    expect(getPreference('theme.active')).toBe('qingci')
  })

  it('v10 把页面左右内距归零并保留上下内距', async () => {
    await createLegacyDb(dbPath, 9, (db) => {
      const token = {
        ...customToken(),
        page: { paddingTop: 24, paddingRight: 12, paddingBottom: 24, paddingLeft: 12 },
      }
      db.prepare(
        `INSERT INTO themes (id, name, token, css, token_version, sort, created_at, updated_at)
         VALUES ('legacy', '旧主题', ?, '', 1, 0, '2026-01-01', '2026-01-01')`
      ).run(JSON.stringify(token))
    })
    initLocalStore(dbPath)
    const theme = getTheme('legacy')
    expect(theme?.token.page).toEqual({
      paddingTop: 24,
      paddingRight: 0,
      paddingBottom: 24,
      paddingLeft: 0,
    })
  })

  it('v11 把旧变量前缀改写为 --theme-', async () => {
    await createLegacyDb(dbPath, 10, (db) => {
      db.prepare(
        `INSERT INTO themes (id, name, token, css, token_version, sort, created_at, updated_at)
         VALUES ('legacy', '旧主题', ?, 'h1 { color: var(--fucha-primary); }', 1, 0, '2026-01-01', '2026-01-01')`
      ).run(JSON.stringify(customToken()))
    })
    initLocalStore(dbPath)
    expect(getTheme('legacy')?.css).toBe('h1 { color: var(--theme-primary); }')
  })

  it('迁移只执行一次：重复打开不改变数据', async () => {
    initLocalStore(dbPath)
    save('a'.repeat(32))
    closeLocalStore()
    initLocalStore(dbPath)
    expect(getArticle('a'.repeat(32))?.title).toBe('文章 aaaa')
  })
})

describe('偏好', () => {
  beforeEach(() => initLocalStore(dbPath))

  it('缺失的键返回 undefined', () => {
    expect(getPreference('missing.key')).toBeUndefined()
  })

  it('重复写入只保留最新值', () => {
    setPreference('theme.active', 'shujuan')
    setPreference('theme.active', 'custom')
    expect(getPreference('theme.active')).toBe('custom')

    const db = new DatabaseSync(dbPath)
    const row = db.prepare('SELECT COUNT(*) AS count FROM preferences').get() as { count: number }
    db.close()
    expect(row.count).toBe(1)
  })

  it('支持 JSON 值', () => {
    setPreference('layout', { collapsed: true, width: 248 })
    expect(getPreference('layout')).toEqual({ collapsed: true, width: 248 })
  })
})

describe('自定义主题', () => {
  beforeEach(() => initLocalStore(dbPath))

  it('创建主题并读取 css 与 token 版本', () => {
    const record = createTheme({ token: customToken(), css: 'h1 { color: red; }' })
    expect(record.id).toBe('custom-a')
    expect(record.css).toBe('h1 { color: red; }')
    expect(record.tokenVersion).toBe(1)
    expect(listThemes()).toHaveLength(1)
  })

  it('同一 id 不能重复创建', () => {
    createTheme({ token: customToken(), css: '' })
    createTheme({ token: customToken('other', '另一个'), css: '' })
    const token = customToken()
    token.name = '换个名字'
    expect(() => createTheme({ token, css: '' })).toThrow('主题 id 已存在')
  })

  it('内置主题 id 不能被占用', () => {
    const token = { ...customToken('default', '我的主题') }
    expect(() => createTheme({ token, css: '' })).toThrow('主题 id 与内置主题冲突')
  })

  it('不能与内置主题重名', () => {
    const token = customToken('mine', '书卷')
    expect(() => createTheme({ token, css: '' })).toThrow('主题名称与内置主题冲突')
  })

  it('不能与其他自定义主题重名（忽略大小写）', () => {
    createTheme({ token: customToken('a1', 'Alpha'), css: '' })
    expect(() => createTheme({ token: customToken('a2', 'alpha'), css: '' })).toThrow(
      '主题名称已存在'
    )
  })

  it('不能写入内置主题 token', () => {
    expect(() =>
      createTheme({ token: { ...structuredClone(DEFAULT_THEME.token), builtin: true }, css: '' })
    ).toThrow('内置主题不能写入自定义主题表')
  })

  it('非法 token 与非法 CSS 被拒绝', () => {
    const token = customToken()
    token.text.fontSize = 99
    expect(() => createTheme({ token, css: '' })).toThrow('theme.text.fontSize')

    expect(() =>
      createTheme({ token: customToken('ok', '正常'), css: 'h1 { position: fixed; }' })
    ).toThrow('使用了微信不支持的属性')
  })

  it('原地更新主题内容', () => {
    createTheme({ token: customToken(), css: '' })
    const token = customToken()
    token.primary = '#123456'
    const updated = updateTheme({
      id: 'custom-a',
      token,
      css: 'h1 { color: var(--theme-primary); }',
    })
    expect(updated.token.primary).toBe('#123456')
    expect(updated.css).toContain('--theme-primary')
  })

  it('更新不存在的主题或内置主题被拒', () => {
    expect(() => updateTheme({ id: 'nope', token: customToken('nope', '无'), css: '' })).toThrow(
      '主题不存在'
    )
    expect(() =>
      updateTheme({ id: 'default', token: customToken('default', '雾紫'), css: '' })
    ).toThrow('主题 id 与内置主题冲突')
  })

  it('改名不能与其他主题重名', () => {
    createTheme({ token: customToken('a1', 'Alpha'), css: '' })
    createTheme({ token: customToken('a2', 'Beta'), css: '' })
    expect(() => updateTheme({ id: 'a2', token: customToken('a2', 'Alpha'), css: '' })).toThrow(
      '主题名称已存在'
    )
  })

  it('被文章引用的主题不能删除', () => {
    createTheme({ token: customToken(), css: '' })
    save('a'.repeat(32), { themeId: 'custom-a' })
    expect(() => deleteTheme('custom-a')).toThrow('仍被 1 篇文章引用')
  })

  it('删除未被引用的主题，并把来源引用置空', () => {
    createTheme({ token: customToken('base', '基础'), css: '' })
    createTheme({ token: customToken('derived', '派生'), css: '', sourceThemeId: 'base' })
    deleteTheme('base')
    expect(getTheme('base')).toBeUndefined()
    expect(getTheme('derived')?.sourceThemeId).toBeUndefined()
  })
})

describe('文章历史', () => {
  beforeEach(() => initLocalStore(dbPath))

  it('保存快照并读取图片顺序', () => {
    const stored = save('a'.repeat(32), { title: '第一篇' })
    expect(stored.title).toBe('第一篇')
    expect(stored.themeId).toBe('default')
    expect(stored.images.map((image) => image.id)).toEqual(['img-1', 'img-2'])
    expect(stored.images[0]?.width).toBe(10)
  })

  it('新建文章排到最前，重新保存回到顶部', async () => {
    save('a'.repeat(32))
    await sleep(5)
    save('b'.repeat(32))
    expect(listArticles()[0]?.hash).toBe('b'.repeat(32))

    await sleep(5)
    save('a'.repeat(32))
    expect(listArticles()[0]?.hash).toBe('a'.repeat(32))
    expect(listArticles()).toHaveLength(2)
  })

  it('重新提取保留文章级主题', async () => {
    save('a'.repeat(32), { themeId: 'custom-a' })
    await sleep(5)
    expect(save('a'.repeat(32)).themeId).toBe('custom-a')
  })

  it('文章主题可以单独切换', () => {
    save('a'.repeat(32))
    expect(setArticleTheme('a'.repeat(32), 'shujuan')).toBe(true)
    expect(getArticle('a'.repeat(32))?.themeId).toBe('shujuan')
    expect(setArticleTheme('b'.repeat(32), 'shujuan')).toBe(false)
  })

  it('touch 增加访问次数但不改变排序', async () => {
    save('a'.repeat(32))
    await sleep(5)
    save('b'.repeat(32))

    expect(touchArticle('a'.repeat(32))).toBe(true)
    expect(listArticles()[0]?.hash).toBe('b'.repeat(32))
    expect(getArticle('a'.repeat(32))?.visitCount).toBe(1)
  })

  it('整体替换图片且不改文章更新时间', async () => {
    const before = save('a'.repeat(32))
    await sleep(5)
    replaceArticleImages('a'.repeat(32), [
      { id: 'img-9', originalUrl: 'https://example.com/9.png', status: 'failed' },
    ])
    const after = getArticle('a'.repeat(32))
    expect(after?.images.map((image) => image.id)).toEqual(['img-9'])
    expect(after?.updatedAt).toBe(before.updatedAt)
  })

  it('替换不存在文章的图片时报错', () => {
    expect(() => replaceArticleImages('b'.repeat(32), [])).toThrow('文章快照不存在')
  })

  it('非法图片状态被拒', () => {
    save('a'.repeat(32))
    expect(() =>
      replaceArticleImages('a'.repeat(32), [
        { id: 'x', originalUrl: 'https://e.test/x.png', status: 'weird' as never },
      ])
    ).toThrow('图片状态不合法')
  })

  it('非法 hash 与分页参数被拒', () => {
    expect(() => getArticle('not-a-hash')).toThrow('文章 hash 不合法')
    expect(() => listArticles(0)).toThrow('分页参数不合法')
    expect(() => listArticles(-1)).toThrow('分页参数不合法')
  })

  it('删除单篇文章与清空历史', () => {
    save('a'.repeat(32))
    save('b'.repeat(32))
    expect(deleteArticle('a'.repeat(32))).toBe(true)
    expect(getArticle('a'.repeat(32))).toBeUndefined()
    expect(deleteArticle('a'.repeat(32))).toBe(false)

    clearHistory()
    expect(listArticles()).toEqual([])
  })
})
