import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'

export const LOCAL_STORE_SCHEMA_VERSION = 11

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
  sort INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE articles (
  hash TEXT PRIMARY KEY CHECK (length(hash) = 32),
  source_url TEXT NOT NULL,
  final_url TEXT NOT NULL,
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

CREATE INDEX articles_activity_idx ON articles(MAX(COALESCE(last_visited_at, updated_at), updated_at) DESC);
CREATE INDEX articles_final_url_idx ON articles(final_url);
CREATE INDEX article_images_url_idx ON article_images(original_url);
`

const V2_SCHEMA = `
ALTER TABLE articles ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'technical';
CREATE INDEX articles_theme_idx ON articles(theme_id);
`

const V3_SCHEMA = `
DROP INDEX IF EXISTS articles_theme_idx;
ALTER TABLE articles ADD COLUMN theme_id_next TEXT NOT NULL DEFAULT 'default';
UPDATE articles SET theme_id_next = CASE WHEN theme_id = 'technical' THEN 'default' ELSE theme_id END;
ALTER TABLE articles DROP COLUMN theme_id;
ALTER TABLE articles RENAME COLUMN theme_id_next TO theme_id;
CREATE INDEX articles_theme_idx ON articles(theme_id);
UPDATE preferences SET value = '"default"' WHERE key = 'theme.active' AND value = '"technical"';
`

const V4_SCHEMA = `
ALTER TABLE themes ADD COLUMN css TEXT NOT NULL DEFAULT '';
ALTER TABLE themes ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE themes ADD COLUMN source_theme_id TEXT;
`

const V5_SCHEMA = `
DROP INDEX IF EXISTS articles_activity_idx;
CREATE INDEX IF NOT EXISTS articles_updated_idx ON articles(updated_at DESC);
`

const V6_SCHEMA = `
DROP INDEX IF EXISTS articles_final_url_idx;
DROP INDEX IF EXISTS article_images_url_idx;
DROP INDEX IF EXISTS articles_updated_idx;
CREATE INDEX articles_updated_idx ON articles(updated_at DESC, created_at DESC);
CREATE INDEX themes_sort_idx ON themes(sort, created_at);
CREATE UNIQUE INDEX themes_name_idx ON themes(name COLLATE NOCASE);
`

const V7_SCHEMA = `
UPDATE articles SET theme_id = 'shujuan' WHERE theme_id = 'serif';
UPDATE themes SET source_theme_id = 'shujuan' WHERE source_theme_id = 'serif';
UPDATE preferences SET value = '"shujuan"' WHERE key = 'theme.active' AND value = '"serif"';
`

const V8_SCHEMA = `
UPDATE articles SET theme_id = 'default' WHERE theme_id = 'xueqing';
UPDATE themes SET source_theme_id = 'default' WHERE source_theme_id = 'xueqing';
UPDATE preferences SET value = '"default"' WHERE key = 'theme.active' AND value = '"xueqing"';
`

const V9_SCHEMA = `
UPDATE articles SET theme_id = 'qingci' WHERE theme_id = 'danxia';
UPDATE themes SET source_theme_id = 'qingci' WHERE source_theme_id = 'danxia';
UPDATE preferences SET value = '"qingci"' WHERE key = 'theme.active' AND value = '"danxia"';
`

const V10_SCHEMA = `
UPDATE themes SET token = json_set(token, '$.page.paddingLeft', 0, '$.page.paddingRight', 0);
`

// 品牌解耦：已存主题 CSS 的旧变量前缀统一改写为 --theme-
const V11_SCHEMA = `
UPDATE themes SET css = replace(css, '--fucha-', '--theme-');
`

type Migration = {
  version: number
  sql: string
}

/** 迁移序列按版本升序执行；测试用它构造历史版本数据库 */
export const MIGRATIONS: Migration[] = [
  { version: 1, sql: V1_SCHEMA },
  { version: 2, sql: V2_SCHEMA },
  { version: 3, sql: V3_SCHEMA },
  { version: 4, sql: V4_SCHEMA },
  { version: 5, sql: V5_SCHEMA },
  { version: 6, sql: V6_SCHEMA },
  { version: 7, sql: V7_SCHEMA },
  { version: 8, sql: V8_SCHEMA },
  { version: 9, sql: V9_SCHEMA },
  { version: 10, sql: V10_SCHEMA },
  { version: 11, sql: V11_SCHEMA },
]

let database: DatabaseSync | null = null
let storeError: string | null = null
let storePath = ''

const DB_FILE = 'app.db'

function readUserVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  return row?.user_version ?? 0
}

/** 主进程启动时调用；失败只标记存储不可用，不抛出到应用启动流程 */
export function initLocalStore(dbPath = join(app.getPath('userData'), DB_FILE)): LocalStoreStatus {
  closeLocalStore()
  storePath = dbPath

  let next: DatabaseSync | null = null
  try {
    mkdirSync(dirname(dbPath), { recursive: true })
    next = new DatabaseSync(dbPath)
    next.exec('PRAGMA journal_mode = WAL')
    next.exec('PRAGMA synchronous = NORMAL')
    next.exec('PRAGMA foreign_keys = ON')
    next.exec('PRAGMA busy_timeout = 5000')

    let version = readUserVersion(next)
    if (version > LOCAL_STORE_SCHEMA_VERSION) {
      next.close()
      storeError = `数据库版本 ${version} 高于代码支持的 ${LOCAL_STORE_SCHEMA_VERSION}`
      return { available: false, path: dbPath, error: storeError }
    }

    for (const migration of MIGRATIONS) {
      if (version >= migration.version) continue
      next.exec('BEGIN')
      try {
        next.exec(migration.sql)
        next.exec(`PRAGMA user_version = ${migration.version}`)
        next.exec('COMMIT')
        version = migration.version
      } catch (error) {
        next.exec('ROLLBACK')
        throw error
      }
    }

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
