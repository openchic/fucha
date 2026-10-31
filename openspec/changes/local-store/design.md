## Context

当前应用只在 `userData/article-cache/<hash>/` 保存图片，主题与偏好尚未持久化。历史侧栏、自定义主题与偏好设置都需要结构化本地存储，继续按功能分别写 JSON 会形成多套写入、查询和迁移逻辑。表结构已在 `docs/local-store.md` 确认，本 change 只实现存储底座。

## Goals / Non-Goals

**Goals:**

- 用 Electron 自带 `node:sqlite` 建立单一 SQLite 数据文件。
- 实现 v1 schema、`PRAGMA user_version` 迁移与主进程仓储。
- 为历史与主题后续功能提供可测试的 preferences/themes/articles/article_images 数据能力。
- 数据库失败时保持抓取、提取、预览主链路可用。

**Non-Goals:**

- 历史侧栏 UI、左右布局与快照路由。
- 渲染进程 IPC、preload 暴露存储 API。
- FTS5 全文搜索。
- 全局缓存孤儿清理。

## Decisions

**使用 `node:sqlite`，不用 `better-sqlite3`。** 当前 Electron 39 自带 Node 22.22.1，已验证 SQLite 3.51.2 与 FTS5；内置驱动不引入原生编译与打包链路。代价是 experimental API，因此数据库访问集中在 `src/main/db.ts`，升级 Electron 时以主进程 harness 冒烟。备选 `better-sqlite3` API 更稳定，但需要 Electron ABI 重建，收益不足以抵消成本。

**文章正文存 SQLite，图片字节仍存文件系统。** 正文是打开快照的主数据，放进 `articles.html` 可让一次读取完成；图片可能很大且已有 `fucha://` 协议，数据库只存 `article_images` 元数据。备选把图片转 BLOB 会膨胀数据库并绕开现有缓存。

**主进程 repository，不先做 IPC。** `src/main/store.ts` 暴露类型化函数，由 `history-sidebar` 和 `theme-panel` 按真实界面需求再选择 IPC 面。现在暴露无消费者 API 会冻结尚未验证的跨进程契约。

**版本只存 `PRAGMA user_version`。** 不建 `schema_meta` 表；当前 schema 为 v4：v1 建表，v2 增加文章主题字段与索引，v3 把默认主题 id 从 `technical` 统一为 `default` 并更新已有文章与偏好，v4 为 `themes` 增加 `css`、`token_version` 与 `source_theme_id`。未来迁移继续按版本顺序执行。代价是没有迁移审计时间，当前应用不需要。

**主题表只存自定义主题，校验提升到 shared。** 内置主题留在代码，避免代码与数据库两份来源。ThemeToken 校验在 `src/shared/theme.ts`，主题 CSS 契约校验在 `src/shared/theme-css.ts`；主进程写入前同时校验 token 与 CSS，渲染层使用同一入口。

**图片元数据按集合替换，文件映射只留 index.json。** 重新提取时先删该 hash 的旧 `article_images` 再写当前集合，避免旧图残留；下载状态变化提交完整图片列表。数据库不存 `local_path`，物理文件名仍由 `article-cache/<hash>/index.json` 唯一负责，快照消费方按 hash 读取映射，缺失即按失败占位。

**删除历史只删数据库行。** 当前预览与导出可能正在使用缓存文件，直接删目录会产生竞态和裂图；当前版本只删 `articles` 与级联的 `article_images`，缓存清理留给后续有「无活跃预览」前提的清理任务。

**历史排序按最近活动时间，不按首次访问。** 列表使用 `MAX(COALESCE(last_visited_at, updated_at), updated_at) DESC`：首次 upsert 写 `last_visited_at`，重新提取刷新 `updated_at`，打开文章刷新 `last_visited_at`，因此新建、重新提取和打开都会回到顶部。活动时间用表达式索引 `articles_activity_idx` 覆盖，避免新增冗余时间列。

**文章主题只存引用 id，不存 token 快照。** `articles.theme_id` 默认 `default`；首次 upsert 写入当前选择的主题，重新提取保留文章原主题，`setArticleTheme` 只更新引用 id。主题是不可变快照，编辑主题会生成新 id，因此历史文章不会被静默改版；删除仍被文章引用的主题会被拒绝，消费方读取到未知 id 时回退默认主题但保留原引用。

**测试使用可注入的数据库路径。** `initLocalStore(dbPath?)` 默认取 `userData/fucha.db`，harness 传入临时路径，避免污染真实历史。`user_version` 高于代码支持版本时不迁移，直接判定存储不可用。

**启动失败采用降级。** `initLocalStore()` 返回可用状态；失败时历史/主题仓储抛明确错误，但不让 `app.whenReady()` 失败。抓取与预览不依赖数据库。

## Risks / Trade-offs

- [`node:sqlite` experimental] → 集中封装、固定 Electron 版本、升级跑 harness；数据库失败不阻断主链路。
- [文章 HTML 增大数据库] → 只存净化正文，图片不进库；后续可加保留策略，不在 v1 猜测阈值。
- [图片状态与缓存映射不一致] → 数据库只存状态，`index.json` 是物理映射唯一来源；索引缺失按失败占位。
- [删除历史与预览/导出的竞态] → v1 只删数据库行，缓存目录清理放到后续独立任务。
- [并发写入] → Electron 主进程单线程调用仓储，SQLite WAL 处理文件级并发；不使用渲染进程直连。
- [数据库损坏或版本过高] → 初始化捕获异常并降级；不迁移高于代码版本的库，v1 无历史数据可迁移，损坏时允许重建空库。

## Migration Plan

新增文件与启动初始化，不迁移既有 JSON。回滚时移除 `src/main/db.ts`、`src/main/store.ts`、`src/shared/store-types.ts`、`src/shared/theme.ts` 与启动调用；`userData/fucha.db` 可安全删除，图片缓存不受影响。

## Open Questions

无。表结构、驱动与后续 change 边界已在对话中确认。
