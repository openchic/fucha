# 本地存储与历史快照设计

本地存储为历史文章快照、自定义主题和偏好设置提供持久化。历史侧栏的界面与路由见 [设计与架构](design.md#界面)。

## 存储边界

- 正式版的 `userData` 为 `appData/fucha`；`pnpm dev` 和独立打包的 Debug 版均使用 `appData/fucha-dev`。两个目录各自保存数据库、缓存和偏好，`--user-data-dir` 可显式覆盖。
- SQLite 文件为各自的 `userData/app.db`。
- 图片字节仍存现有目录 `userData/article-cache/<hash>/`，不写入数据库。
- 文章 `hash` 取 `SHA-256(finalUrl)` 前 32 位，与图片缓存目录同名。
- 数据库读写集中在主进程，渲染进程通过 preload 调用领域方法。

## 驱动选择

使用 Electron 自带的 `node:sqlite`，数据库集中在主进程访问，无需额外编译原生模块。

## 表结构

### preferences

| 字段         | 类型 | 约束                      | 说明                                    |
| ------------ | ---- | ------------------------- | --------------------------------------- |
| `key`        | TEXT | PRIMARY KEY，CHECK 非空   | 如 `theme.active`、`sidebar.collapsed` |
| `value`      | TEXT | NOT NULL，CHECK JSON 合法 | JSON 标量或对象                         |
| `updated_at` | TEXT | NOT NULL                  | ISO 8601 UTC                            |

### themes

| 字段              | 类型    | 约束                      | 说明                                          |
| ----------------- | ------- | ------------------------- | --------------------------------------------- |
| `id`              | TEXT    | PRIMARY KEY，CHECK 非空   | 如 `custom-forest`，不能与内置主题 id 冲突    |
| `name`            | TEXT    | NOT NULL，CHECK 非空      | 面板显示名，可改名                            |
| `token`           | TEXT    | NOT NULL，CHECK JSON 合法 | ThemeToken JSON，写入与读取均走共享校验       |
| `css`             | TEXT    | NOT NULL，默认空          | theme.css 全文，写入前做 fail-closed 校验     |
| `token_version`   | INTEGER | NOT NULL，默认 1          | token 接口版本                                |
| `source_theme_id` | TEXT    | 可空                      | 另存为的来源 id，支持内置主题 id，故不设外键   |
| `sort`            | INTEGER | NOT NULL                  | 自定义主题排序                                |
| `created_at`      | TEXT    | NOT NULL                  | ISO 8601 UTC                                  |
| `updated_at`      | TEXT    | NOT NULL                  | ISO 8601 UTC                                  |

内置主题由代码提供，`themes` 只存自定义主题。创建与更新共用 [token 校验](../src/shared/theme.ts)和 [CSS 校验](../src/shared/theme-css.ts)，主进程在写入前执行校验。

主题名称在内置与自定义主题间全局唯一，英文大小写视为相同。创建、导入和改名时检查重名，已有重名数据可在名称未变时保存。

从默认 token 新建或从主题包导入时，`source_theme_id` 为空。删除自定义主题前检查 `articles.theme_id`，仍被引用时拒绝删除；删除成功时在同一事务中清空其他主题指向它的 `source_theme_id`。

`preferences.theme.active` 保存新文章的默认主题，已有文章使用各自的 `articles.theme_id`。

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

只保存成功提取的文章。同一 `finalUrl` 再次提取时按 `hash` 更新正文、来源元数据和 `updated_at`，保留已有的 `theme_id` 和访问记录。修改文章主题通过 `setArticleTheme` 只更新引用 id。

### article_images

| 字段           | 类型    | 约束                                              | 说明                |
| -------------- | ------- | ------------------------------------------------- | ------------------- |
| `article_hash` | TEXT    | NOT NULL，外键 `articles.hash`，ON DELETE CASCADE | 所属文章            |
| `id`           | TEXT    | NOT NULL，CHECK 非空                              | Article 内的图片 ID |
| `original_url` | TEXT    | NOT NULL，CHECK 非空                              | 原始图片地址        |
| `status`       | TEXT    | NOT NULL，CHECK 为 `pending` / `done` / `failed`  | 下载状态            |
| `width`        | INTEGER | 可空                                              | 图片宽              |
| `height`       | INTEGER | 可空                                              | 图片高              |
| `sort`         | INTEGER | NOT NULL，CHECK 大于等于 0                        | 正文出现顺序        |
| 复合主键       |         | PRIMARY KEY (`article_hash`, `id`)                | 同一文章内图片唯一  |

物理文件映射仍由 `article-cache/<hash>/index.json` 负责，数据库不重复保存 `local_path`。快照恢复时由消费方按 hash 读取缓存索引；索引里没有映射的图片按失败占位处理。

### 索引

| 索引名                 | 表         | 字段                               | 用途                            |
| ---------------------- | ---------- | ---------------------------------- | ------------------------------- |
| `articles_updated_idx` | `articles` | `updated_at DESC, created_at DESC` | 历史列表排序，覆盖完整 ORDER BY |
| `articles_theme_idx`   | `articles` | `theme_id`                         | 按主题查找引用文章              |
| `themes_sort_idx`      | `themes`   | `sort, created_at`                 | 自定义主题列表稳定排序          |
| `themes_name_idx`      | `themes`   | `name COLLATE NOCASE`（唯一）      | 主题名称大小写不敏感唯一与查重  |

## 初始化与版本保护

- 新库按 [初始 schema](../src/main/db.ts)在同一事务中创建表、索引并写入 `PRAGMA user_version`。
- 高于程序支持的版本时保留数据库内容，标记存储不可用。
- 数据库打开或初始化失败时，应用回退到默认主题与空历史，抓取与预览仍可用。
- 测试通过独立的数据目录或显式数据库路径运行。

启动不自动迁移、合并或删除其他目录。`appData/fucha` 中若已有高版本数据库，仍按版本保护规则保留原文件并标记存储不可用。

## 数据访问边界

领域方法由 [主进程存储模块](../src/main/store.ts)提供。

| 领域 | 方法                                                                                              | 说明                     |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------ |
| 偏好 | `getPreference(key)` / `setPreference(key, value)`                                                 | 单键读写，值为 JSON      |
| 主题 | `listThemes()` / `getTheme(id)` / `createTheme(snapshot)` / `updateTheme(input)` / `deleteTheme(id)` | 自定义主题读写与删除     |
| 历史 | `listArticles(limit, offset)` / `getArticle(hash)` / `touchArticle(hash)`                           | 读取摘要与快照、记录访问 |
| 历史 | `upsertArticle(snapshot)` / `replaceArticleImages(hash, images)`                                  | 写入快照、更新图片状态   |
| 历史 | `setArticleTheme(hash, themeId)` / `deleteArticle(hash)` / `clearHistory()`                        | 修改主题引用、删除历史   |

写入文章与替换图片元数据在同一事务内完成。下载状态变化时，`replaceArticleImages` 整体替换该文章的图片元数据，避免残留旧图。

历史列表按 `updated_at DESC, created_at DESC` 排序，新建和重新提取会把该文章排到列表顶部。首次写入设置 `last_visited_at`，随后打开快照时由 `touchArticle` 更新它并递增 `visit_count`，列表顺序保持不变。

删除历史时，图片元数据随文章行级联删除，缓存文件继续保留，供可能仍在进行的预览或导出使用。

## 存储限制

- 标题、地址或正文全文搜索。
- 历史分页与跨设备同步。
- 缓存文件不会随历史记录清理。
