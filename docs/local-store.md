# 本地存储与历史快照设计

为历史侧栏、自定义主题与偏好设置提供统一的本地数据底座。本文定表结构与存储边界；历史侧栏界面只描述读取路径，视觉规范与全文搜索不在本文范围。

## 存储边界

- SQLite 文件：`userData/fucha.db`。
- 图片字节仍存现有目录 `userData/article-cache/<hash>/`，不写入数据库。
- 文章 `hash` 取 `SHA-256(finalUrl)` 前 32 位，与图片缓存目录同名。
- 数据库读写只在主进程；渲染进程经 preload 暴露的领域方法使用存储，不直接执行 SQL。历史栏用 `listArticles` 读摘要，点击后用 `getArticle(hash)` 打开快照并 `touchArticle`；应用默认进入 Home 布局的 `/`（New 输入页），打开历史切换到 `/preview`，左侧历史栏常驻。
- v1 是初始 schema，当前 schema 为 v4；迁移只处理本文件定义的旧版本。

## 驱动选择

使用 Electron 自带 Node 的 `node:sqlite`，不引 `better-sqlite3`。

已验证环境为 Electron 39.8.10、Node 22.22.1、SQLite 3.51.2，FTS5 可建表。`node:sqlite` 仍是 experimental，因此数据库访问集中在主进程单一模块，升级 Electron 时跑一次冒烟测试；它避免了原生模块重编译与打包链路改动。

## 表结构

### preferences

| 字段         | 类型 | 约束                      | 说明                                    |
| ------------ | ---- | ------------------------- | --------------------------------------- |
| `key`        | TEXT | PRIMARY KEY，CHECK 非空   | 如 `theme.active`、`history.panelWidth` |
| `value`      | TEXT | NOT NULL，CHECK JSON 合法 | JSON 标量或对象                         |
| `updated_at` | TEXT | NOT NULL                  | ISO 8601 UTC                            |

### themes

| 字段              | 类型    | 约束                      | 说明                                          |
| ----------------- | ------- | ------------------------- | --------------------------------------------- |
| `id`              | TEXT    | PRIMARY KEY               | 如 `custom-forest`，不能与内置主题 id 冲突    |
| `name`            | TEXT    | NOT NULL，CHECK 非空      | 面板显示名，可改名                            |
| `token`           | TEXT    | NOT NULL，CHECK JSON 合法 | ThemeToken JSON，写入与读取均走共享校验       |
| `css`             | TEXT    | NOT NULL，默认空          | theme.css 全文，写入前做 fail-closed 校验     |
| `token_version`   | INTEGER | NOT NULL，默认 1          | token 接口版本                                |
| `source_theme_id` | TEXT    | 可空                      | 来源主题 id；来源可以是内置主题，因此不做外键 |
| `sort`            | INTEGER | NOT NULL                  | 自定义主题排序                                |
| `created_at`      | TEXT    | NOT NULL                  | ISO 8601 UTC                                  |
| `updated_at`      | TEXT    | NOT NULL                  | ISO 8601 UTC                                  |

自定义主题可编辑：`updateTheme` 一并更新 `name`、`token`、`css` 与 `updated_at`，所有 `articles.theme_id` 指向它的文章同步使用新内容；只改名时除 `name` 与 `updated_at` 外内容不变。主题名称全局唯一（含内置主题，不区分英文大小写），创建、导入与改名遇到重名会拒绝；已有重名数据不改写，未改名的保存不受影响。另存为与新建通过 `createTheme` 生成新 id；删除来源主题时把其他行的 `source_theme_id` 置空。内置主题不写入此表，继续由代码提供且只读；`preferences.theme.active` 只保存新文章默认主题 id，文章自己的主题见 `articles.theme_id`。

### articles

| 字段              | 类型    | 约束                                 | 说明                                                           |
| ----------------- | ------- | ------------------------------------ | -------------------------------------------------------------- |
| `hash`            | TEXT    | PRIMARY KEY，CHECK 长度为 32         | SHA-256(finalUrl) 前 32 位                                     |
| `source_url`      | TEXT    | NOT NULL                             | 用户提交的原始链接                                             |
| `final_url`       | TEXT    | NOT NULL                             | 跟随重定向后的链接                                             |
| `theme_id`        | TEXT    | NOT NULL DEFAULT 'default'           | 文章使用的主题 id，只存引用不存 token                          |
| `title`           | TEXT    | NOT NULL                             | 文章标题                                                       |
| `author`          | TEXT    | 可空                                 | 来源作者                                                       |
| `published_at`    | TEXT    | 可空                                 | 来源发布时间，原样保存                                         |
| `cover`           | TEXT    | 可空                                 | 封面地址                                                       |
| `html`            | TEXT    | NOT NULL                             | 已净化正文，img 仍指向原始地址                                 |
| `created_at`      | TEXT    | NOT NULL                             | 首次快照时间                                                   |
| `updated_at`      | TEXT    | NOT NULL                             | 最近一次重新提取时间                                           |
| `last_visited_at` | TEXT    | 可空                                 | 最近打开时间；仅记录，不参与排序与列表展示，保留给后续阅读状态 |
| `visit_count`     | INTEGER | NOT NULL DEFAULT 0，CHECK 大于等于 0 | 打开次数；仅记录，当前不展示                                   |

只保存成功提取的文章。同一 `finalUrl` 再次提取时按 `hash` upsert，更新 `html` 与 `updated_at`，保留文章已有的 `theme_id`，不新增记录。修改文章主题通过 `setArticleTheme` 只更新引用 id；编辑主题会原地更新主题行，引用该主题的文章在下次渲染时同步换样。

### article_images

| 字段           | 类型    | 约束                                              | 说明                |
| -------------- | ------- | ------------------------------------------------- | ------------------- |
| `article_hash` | TEXT    | NOT NULL，外键 `articles.hash`，ON DELETE CASCADE | 所属文章            |
| `id`           | TEXT    | NOT NULL                                          | Article 内的图片 ID |
| `original_url` | TEXT    | NOT NULL                                          | 原始图片地址        |
| `status`       | TEXT    | NOT NULL，CHECK 为 `pending` / `done` / `failed`  | 下载状态            |
| `width`        | INTEGER | 可空                                              | 图片宽              |
| `height`       | INTEGER | 可空                                              | 图片高              |
| `sort`         | INTEGER | NOT NULL，CHECK 大于等于 0                        | 正文出现顺序        |
| 复合主键       |         | PRIMARY KEY (`article_hash`, `id`)                | 同一文章内图片唯一  |

物理文件映射仍由 `article-cache/<hash>/index.json` 负责，数据库不重复保存 `local_path`。快照恢复时由消费方按 hash 读取缓存索引；索引里没有映射的图片按失败占位处理。

### 索引

| 索引名                   | 表               | 字段              | 用途                   |
| ------------------------ | ---------------- | ----------------- | ---------------------- |
| `articles_updated_idx`   | `articles`       | `updated_at DESC` | 历史列表按最近提取排序 |
| `articles_theme_idx`     | `articles`       | `theme_id`        | 按主题查找引用文章     |
| `articles_final_url_idx` | `articles`       | `final_url`       | 按最终地址查找与去重   |
| `article_images_url_idx` | `article_images` | `original_url`    | 缓存复用与孤儿检查     |

## 版本与迁移

- 版本号存 SQLite 内置的 `PRAGMA user_version`，不建 `schema_meta` 表。
- 首次打开时按顺序执行 v1 建表、v2 主题字段迁移、v3 默认主题 id 迁移、v4 主题字段迁移与 v5 历史排序索引迁移，并把 `user_version` 设置为 5。
- v2 为 `articles` 增加 `theme_id` 与 `articles_theme_idx`；v3 将默认主题 id 从 `technical` 统一为 `default`，已有文章与 `theme.active` 偏好一并更新；v4 为 `themes` 增加 `css`、`token_version` 与 `source_theme_id`；v5 用 `articles_updated_idx` 替换旧的按访问活动排序索引。
- 后续迁移按版本号顺序执行，每次迁移与版本号更新放在同一事务。
- `user_version` 高于代码支持的版本时判定存储不可用，不执行迁移，避免旧代码改坏新库。
- `initLocalStore()` 支持传入数据库路径，验证包使用临时目录，不污染真实历史。
- 数据库打开或迁移失败时，历史、主题与偏好降级为不可用；抓取与预览主链路仍可启动。
- 不记录迁移审计时间，也没有独立的 schema 元数据表。

## 数据访问边界

主进程提供领域方法，不向渲染进程暴露 SQL：

| 领域 | 方法                                                                                                 | 说明                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 偏好 | `getPreference(key)` / `setPreference(key, value)`                                                   | 单键读写，value 为 JSON                                                                                              |
| 主题 | `listThemes()` / `getTheme(id)` / `createTheme(snapshot)` / `updateTheme(input)` / `deleteTheme(id)` | 创建与更新都经 token 与 CSS 校验；更新同时写入名称并同步引用文章；内置主题不可写；被文章引用时拒绝删除               |
| 历史 | `listArticles(limit, offset)` / `getArticle(hash)`                                                   | 列表与快照读取；图片文件映射从缓存索引解析                                                                           |
| 历史 | `upsertArticle(snapshot)` / `replaceArticleImages(hash, images)` / `touchArticle(hash)`              | snapshot 含 hash/finalUrl/themeId/article/images；首次写入设置最近访问；重新提取保留文章主题；下载完成后替换图片状态 |
| 历史 | `setArticleTheme(hash, themeId)` / `deleteArticle(hash)` / `clearHistory()`                          | 修改文章主题引用；删除只删数据库行与图片元数据                                                                       |

文章与图片写入 SHALL 在同一事务内完成。首次 `upsertArticle` 把 `last_visited_at` 设为当前时间（仅记录）；重新提取刷新 `updated_at`，`touchArticle` 只更新最近访问时间并递增 `visit_count`。列表按 `updated_at DESC` 排序，新建与重新提取回到顶部；打开文章只更新访问次数，不改变排序。`replaceArticleImages` 先删除该 hash 下的旧图片集合，再写入当前集合，避免重新提取后留下旧图；下载状态变化时调用同一方法提交完整图片列表。

## 设计决定

| 项目         | 选择                                                                          | 原因                                                   |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| 版本表       | 使用 `PRAGMA user_version`                                                    | 单整数足够，不额外维护一张表                           |
| 内置主题     | 留在代码，不写入 `themes`                                                     | 避免数据库与代码两份来源                               |
| 主题校验     | 提升到 `src/shared/theme.ts` 与 `src/shared/theme-css.ts`，主进程与渲染层共用 | 写入库前拒绝非法 token 与 CSS，不依赖渲染层            |
| 当前主题     | `preferences.theme.active`                                                    | 只作为新文章默认主题，不决定历史文章                   |
| 文章主题     | `articles.theme_id` 只存引用                                                  | 编辑自定义主题原地更新，引用文章跟随；删除被引用时拒绝 |
| 主题内容     | 自定义主题的 `token` 与 `css` 可通过 `updateTheme` 更新                       | 另存为与新建仍生成新 id；内置主题只读，不写入此表      |
| 失败文章     | 不写入 `articles`                                                             | 历史只展示可打开的快照                                 |
| 重复文章     | 按 `finalUrl` 的 hash upsert                                                  | 重新提取更新快照，不新增记录                           |
| 新建文章     | 首次 upsert 写入 `updated_at`                                                 | 新快照按最近提取时间排到顶部                           |
| 历史排序     | `updated_at DESC, created_at DESC`                                            | 按最近提取排序；打开文章不改变顺序                     |
| 删除历史     | 只删数据库行与图片元数据                                                      | 缓存目录可能被当前预览/导出占用，清理另案              |
| 图片状态更新 | `replaceArticleImages` 整体替换当前图片集合                                   | 重新提取不会留下旧图；下载完成后可更新三态             |
| 图片文件映射 | 缓存 `index.json` 是唯一权威                                                  | 数据库不保存 `local_path`，避免两份映射漂移            |
| 全文搜索     | v1 不建 FTS5                                                                  | 确认搜索为刚需后再加，不改现有表                       |
| 版本回退     | `user_version` 高于代码期望时直接降级                                         | 防止旧代码对新库执行错误迁移                           |
| 时间格式     | ISO 8601 UTC 字符串                                                           | 排序直接可用，跨进程可读                               |

## v5 建表草案

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

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

CREATE INDEX articles_updated_idx ON articles(updated_at DESC);
CREATE INDEX articles_theme_idx ON articles(theme_id);
CREATE INDEX articles_final_url_idx ON articles(final_url);
CREATE INDEX article_images_url_idx ON article_images(original_url);

PRAGMA user_version = 5;
```

## 不在本期

- 标题、地址或正文全文搜索。
- 历史分页与跨设备同步。
- 全局缓存孤儿清理策略。
