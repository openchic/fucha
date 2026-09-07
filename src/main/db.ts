import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'

export const LOCAL_STORE_SCHEMA_VERSION = 1

export type LocalStoreStatus = {
  available: boolean
  path: string
  error?: string
}

const V1_SCHEMA = `
CREATE TABLE preferences (
  key TEXT PRIMARY KEY CHECK (length(trim(key)) > 0),
  value TEXT NOT NULL CHECK (json_valid(value)),
  updated_at TEXT NOT NULL
);

CREATE TABLE themes (
  id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  token TEXT NOT NULL CHECK (json_valid(token)),
  css TEXT NOT NULL DEFAULT '',
  token_version INTEGER NOT NULL DEFAULT 1,
  source_theme_id TEXT,
  sort INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE articles (
  hash TEXT PRIMARY KEY CHECK (length(hash) = 32),
  source_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
  theme_id TEXT NOT NULL DEFAULT 'default',
  title TEXT NOT NULL,
  author TEXT,
  published_at TEXT,
  cover TEXT,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_visited_at TEXT,
  visit_count INTEGER NOT NULL DEFAULT 0 CHECK (visit_count >= 0)
);

CREATE TABLE article_images (
  article_hash TEXT NOT NULL REFERENCES articles(hash) ON DELETE CASCADE,
  id TEXT NOT NULL CHECK (length(trim(id)) > 0),
  original_url TEXT NOT NULL CHECK (length(trim(original_url)) > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed')),
  width INTEGER,
  height INTEGER,
  sort INTEGER NOT NULL CHECK (sort >= 0),
  PRIMARY KEY (article_hash, id)
);

CREATE INDEX articles_updated_idx ON articles(updated_at DESC, created_at DESC);
CREATE INDEX articles_theme_idx ON articles(theme_id);
CREATE INDEX themes_sort_idx ON themes(sort, created_at);
CREATE UNIQUE INDEX themes_name_idx ON themes(name COLLATE NOCASE);
`

let database: DatabaseSync | null = null
let storeError: string | null = null
let storePath = ''

function initializeSchema(db: DatabaseSync): void {
  db.exec('BEGIN IMMEDIATE')
  try {
    const row = db.prepare('PRAGMA user_version').get() as { user_version: number }
    const version = row.user_version
    if (version > LOCAL_STORE_SCHEMA_VERSION) {
      throw new Error(`数据库版本 ${version} 高于代码支持的 ${LOCAL_STORE_SCHEMA_VERSION}`)
    }

    if (version === 0) {
      db.exec(V1_SCHEMA)
      db.exec(`PRAGMA user_version = ${LOCAL_STORE_SCHEMA_VERSION}`)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** 主进程启动时调用；失败只标记存储不可用，不抛出到应用启动流程 */
export function initLocalStore(dbPath = join(app.getPath('userData'), 'app.db')): LocalStoreStatus {
  closeLocalStore()
  storePath = dbPath

  let next: DatabaseSync | null = null
  try {
    mkdirSync(dirname(dbPath), { recursive: true })
    next = new DatabaseSync(dbPath)
    next.exec('PRAGMA busy_timeout = 5000')
    next.exec('PRAGMA journal_mode = WAL')
    next.exec('PRAGMA synchronous = NORMAL')
    next.exec('PRAGMA foreign_keys = ON')

    initializeSchema(next)
    next.exec('PRAGMA optimize')

    database = next
    storeError = null
    return { available: true, path: dbPath }
  } catch (error) {
    next?.close()
    database = null
    storeError = error instanceof Error ? error.message : String(error)
    return { available: false, path: dbPath, error: storeError }
  }
}

export function closeLocalStore(): void {
  if (database) {
    database.close()
    database = null
  }
}

/** 仓储读取连接；存储不可用时抛出明确错误，由调用方决定降级 */
export function getDb(): DatabaseSync {
  if (!database) throw new Error(`本地数据库不可用${storeError ? `：${storeError}` : ''}`)
  return database
}

export function getLocalStoreStatus(): LocalStoreStatus {
  return {
    available: database !== null,
    path: storePath,
    error: storeError ?? undefined,
  }
}
