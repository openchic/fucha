import type { ImageAsset } from '@shared/types'
import type {
  ArticleSnapshotInput,
  ArticleSummary,
  JsonValue,
  StoredArticle,
  StoredImage,
  StoredImageInput,
  ThemeRecord,
  ThemeSnapshotInput,
  ThemeUpdateInput,
} from '@shared/store-types'
import {
  BUILTIN_THEME_IDS,
  BUILTIN_THEME_NAMES,
  THEME_TOKEN_VERSION,
  validateThemeToken,
} from '@shared/theme'
import { validateThemeCss } from '@shared/theme-css'
import { getDb } from './db'

type PreferenceRow = { value: string }
type ThemeRow = {
  id: string
  name: string
  token: string
  css: string
  token_version: number
  source_theme_id: string | null
  sort: number
  created_at: string
  updated_at: string
}
type ArticleRow = {
  hash: string
  source_url: string
  final_url: string
  theme_id: string
  title: string
  author: string | null
  published_at: string | null
  cover: string | null
  html: string
  created_at: string
  updated_at: string
  last_visited_at: string | null
  visit_count: number
}
type ImageRow = {
  id: string
  original_url: string
  status: ImageAsset['status']
  width: number | null
  height: number | null
  sort: number
}

const HASH_PATTERN = /^[0-9a-f]{32}$/

function now(): string {
  return new Date().toISOString()
}

function assertHash(hash: string): void {
  if (!HASH_PATTERN.test(hash)) throw new Error('文章 hash 不合法')
}

function assertImageStatus(status: string): asserts status is ImageAsset['status'] {
  if (status !== 'pending' && status !== 'done' && status !== 'failed') {
    throw new Error(`图片状态不合法：${status}`)
  }
}

function transaction<T>(fn: () => T): T {
  const db = getDb()
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

function replaceImages(hash: string, images: StoredImageInput[]): void {
  const db = getDb()
  db.prepare('DELETE FROM article_images WHERE article_hash = ?').run(hash)
  const insert = db.prepare(
    `INSERT INTO article_images (article_hash, id, original_url, status, width, height, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  images.forEach((image, index) => {
    assertImageStatus(image.status)
    insert.run(
      hash,
      image.id,
      image.originalUrl,
      image.status,
      image.width ?? null,
      image.height ?? null,
      index
    )
  })
}

function rowToTheme(row: ThemeRow): ThemeRecord {
  return {
    id: row.id,
    name: row.name,
    token: validateThemeToken(JSON.parse(row.token)),
    css: row.css,
    tokenVersion: row.token_version,
    sourceThemeId: row.source_theme_id ?? undefined,
    sort: row.sort,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToImage(row: ImageRow): StoredImage {
  return {
    id: row.id,
    originalUrl: row.original_url,
    status: row.status,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    sort: row.sort,
  }
}

function rowToArticle(row: ArticleRow, images: StoredImage[]): StoredArticle {
  return {
    hash: row.hash,
    sourceUrl: row.source_url,
    finalUrl: row.final_url,
    themeId: row.theme_id,
    title: row.title,
    author: row.author ?? undefined,
    publishedAt: row.published_at ?? undefined,
    cover: row.cover ?? undefined,
    html: row.html,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVisitedAt: row.last_visited_at ?? undefined,
    visitCount: row.visit_count,
    images,
  }
}

// ---------- preferences ----------

export function setPreference(key: string, value: JsonValue): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value), now())
}

export function getPreference<T extends JsonValue = JsonValue>(key: string): T | undefined {
  const row = getDb().prepare('SELECT value FROM preferences WHERE key = ?').get(key) as
    PreferenceRow | undefined
  if (!row) return undefined
  return JSON.parse(row.value) as T
}

// ---------- custom themes ----------

const THEME_COLUMNS =
  'id, name, token, css, token_version, source_theme_id, sort, created_at, updated_at'

export function listThemes(): ThemeRecord[] {
  const rows = getDb()
    .prepare(`SELECT ${THEME_COLUMNS} FROM themes ORDER BY sort, created_at`)
    .all() as ThemeRow[]
  return rows.map(rowToTheme)
}

export function getTheme(id: string): ThemeRecord | undefined {
  const row = getDb().prepare(`SELECT ${THEME_COLUMNS} FROM themes WHERE id = ?`).get(id) as
    ThemeRow | undefined
  return row ? rowToTheme(row) : undefined
}

function assertThemeNameAvailable(name: string, excludeId?: string): void {
  const normalized = name.toLowerCase()
  if (Object.values(BUILTIN_THEME_NAMES).some((builtin) => builtin.toLowerCase() === normalized)) {
    throw new Error(`主题名称与内置主题冲突：${name}`)
  }
  const row = excludeId
    ? getDb()
        .prepare('SELECT 1 FROM themes WHERE name = ? COLLATE NOCASE AND id <> ?')
        .get(name, excludeId)
    : getDb().prepare('SELECT 1 FROM themes WHERE name = ? COLLATE NOCASE').get(name)
  if (row) throw new Error(`主题名称已存在：${name}`)
}

/** 新建主题记录；同一 id 或同名主题已存在时拒绝 */
export function createTheme(input: ThemeSnapshotInput): ThemeRecord {
  const token = validateThemeToken(input.token)
  if (token.builtin) throw new Error('内置主题不能写入自定义主题表')
  if ((BUILTIN_THEME_IDS as readonly string[]).includes(token.id)) {
    throw new Error(`主题 id 与内置主题冲突：${token.id}`)
  }
  assertThemeNameAvailable(token.name)
  const tokenVersion = input.tokenVersion ?? THEME_TOKEN_VERSION
  if (tokenVersion !== THEME_TOKEN_VERSION) {
    throw new Error(`不支持的主题 token 版本：${tokenVersion}`)
  }
  const css = validateThemeCss(input.css)
  const sourceThemeId = input.sourceThemeId?.trim() || null

  const db = getDb()
  if (db.prepare('SELECT 1 FROM themes WHERE id = ?').get(token.id)) {
    throw new Error(`主题 id 已存在：${token.id}`)
  }

  const timestamp = now()
  const nextSort = (
    db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM themes').get() as {
      next: number
    }
  ).next

  db.prepare(
    `INSERT INTO themes
       (id, name, token, css, token_version, source_theme_id, sort, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    token.id,
    token.name,
    JSON.stringify(token),
    css,
    tokenVersion,
    sourceThemeId,
    nextSort,
    timestamp,
    timestamp
  )

  return getTheme(token.id)!
}

/** 原地更新自定义主题；所有引用它的文章同步生效 */
export function updateTheme(input: ThemeUpdateInput): ThemeRecord {
  const token = validateThemeToken(input.token)
  if (token.builtin) throw new Error('内置主题不能写入自定义主题表')
  if (token.id !== input.id) throw new Error('主题 id 不匹配')
  if ((BUILTIN_THEME_IDS as readonly string[]).includes(input.id)) {
    throw new Error(`主题 id 与内置主题冲突：${input.id}`)
  }
  const existing = getTheme(input.id)
  if (!existing) throw new Error('主题不存在')
  if (existing.name !== token.name) assertThemeNameAvailable(token.name, input.id)
  const css = validateThemeCss(input.css)
  getDb()
    .prepare(
      `UPDATE themes
       SET name = ?, token = ?, css = ?, token_version = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(token.name, JSON.stringify(token), css, THEME_TOKEN_VERSION, now(), input.id)
  return getTheme(input.id)!
}

export function deleteTheme(id: string): void {
  const db = getDb()
  const referenced = db
    .prepare('SELECT COUNT(*) AS count FROM articles WHERE theme_id = ?')
    .get(id) as {
    count: number
  }
  if (referenced.count > 0) {
    throw new Error(`主题仍被 ${referenced.count} 篇文章引用，不能删除`)
  }
  transaction(() => {
    db.prepare('UPDATE themes SET source_theme_id = NULL WHERE source_theme_id = ?').run(id)
    db.prepare('DELETE FROM themes WHERE id = ?').run(id)
  })
}

// ---------- article history ----------

export function getArticle(hash: string): StoredArticle | undefined {
  assertHash(hash)
  const db = getDb()
  const row = db
    .prepare(
      `SELECT hash, source_url, final_url, theme_id, title, author, published_at, cover, html,
              created_at, updated_at, last_visited_at, visit_count
       FROM articles WHERE hash = ?`
    )
    .get(hash) as ArticleRow | undefined
  if (!row) return undefined
  const images = db
    .prepare(
      `SELECT id, original_url, status, width, height, sort
       FROM article_images WHERE article_hash = ? ORDER BY sort`
    )
    .all(hash) as ImageRow[]
  return rowToArticle(row, images.map(rowToImage))
}

export function listArticles(limit = 50, offset = 0): ArticleSummary[] {
  if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0) {
    throw new Error('历史列表分页参数不合法')
  }
  const rows = getDb()
    .prepare(
      `SELECT hash, source_url, final_url, theme_id, title, created_at, updated_at,
              last_visited_at, visit_count
       FROM articles
       ORDER BY updated_at DESC, created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as Omit<ArticleRow, 'author' | 'published_at' | 'cover' | 'html'>[]
  return rows.map((row) => ({
    hash: row.hash,
    sourceUrl: row.source_url,
    finalUrl: row.final_url,
    themeId: row.theme_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastVisitedAt: row.last_visited_at ?? undefined,
    visitCount: row.visit_count,
  }))
}

export function upsertArticle(input: ArticleSnapshotInput): StoredArticle {
  const { hash, finalUrl, article, images } = input
  const themeId = input.themeId ?? 'default'
  assertHash(hash)
  if (!themeId.trim()) throw new Error('文章主题 id 不合法')
  const db = getDb()

  transaction(() => {
    const existing = db
      .prepare('SELECT created_at, last_visited_at, visit_count FROM articles WHERE hash = ?')
      .get(hash) as
      { created_at: string; last_visited_at: string | null; visit_count: number } | undefined
    const timestamp = now()

    if (existing) {
      db.prepare(
        `UPDATE articles SET
           source_url = ?, final_url = ?, title = ?, author = ?, published_at = ?,
           cover = ?, html = ?, updated_at = ?
         WHERE hash = ?`
      ).run(
        article.sourceUrl,
        finalUrl,
        article.title,
        article.author ?? null,
        article.publishedAt ?? null,
        article.cover ?? null,
        article.html,
        timestamp,
        hash
      )
    } else {
      db.prepare(
        `INSERT INTO articles
           (hash, source_url, final_url, theme_id, title, author, published_at, cover, html,
            created_at, updated_at, last_visited_at, visit_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(
        hash,
        article.sourceUrl,
        finalUrl,
        themeId,
        article.title,
        article.author ?? null,
        article.publishedAt ?? null,
        article.cover ?? null,
        article.html,
        timestamp,
        timestamp,
        timestamp
      )
    }

    replaceImages(hash, images)
  })

  return getArticle(hash)!
}

export function setArticleTheme(hash: string, themeId: string): boolean {
  assertHash(hash)
  if (!themeId.trim()) throw new Error('文章主题 id 不合法')
  const result = getDb()
    .prepare('UPDATE articles SET theme_id = ? WHERE hash = ?')
    .run(themeId.trim(), hash)
  return Number(result.changes) > 0
}

export function replaceArticleImages(hash: string, images: StoredImageInput[]): void {
  assertHash(hash)
  const db = getDb()
  const exists = db.prepare('SELECT 1 FROM articles WHERE hash = ?').get(hash)
  if (!exists) throw new Error('文章快照不存在')
  transaction(() => replaceImages(hash, images))
}

/** 记录最近打开时间与次数；历史排序按 updated_at，这两个字段只作阅读元数据保留 */
export function touchArticle(hash: string): boolean {
  assertHash(hash)
  const result = getDb()
    .prepare(
      'UPDATE articles SET last_visited_at = ?, visit_count = visit_count + 1 WHERE hash = ?'
    )
    .run(now(), hash)
  return Number(result.changes) > 0
}

export function deleteArticle(hash: string): boolean {
  assertHash(hash)
  const result = getDb().prepare('DELETE FROM articles WHERE hash = ?').run(hash)
  return Number(result.changes) > 0
}

export function clearHistory(): void {
  getDb().prepare('DELETE FROM articles').run()
}
