## 1. 数据库与迁移

- [x] 1.1 新增 `src/main/db.ts`，用 Electron 自带 `node:sqlite` 打开数据库（默认 `userData/fucha.db`，支持测试注入路径），设置 WAL、foreign keys、busy timeout 与 `PRAGMA user_version` 检查；验证：临时路径首次初始化生成数据库文件，版本高于代码时判定不可用
- [x] 1.2 实现 v1 建表 SQL（preferences、themes、articles、article_images 及索引，含 JSON、长度、状态与计数 CHECK）；验证：连续初始化两次不重复建表，已有数据保留，非法 JSON/状态被拒
- [x] 1.3 在主进程启动流程调用 `initLocalStore()`，捕获打开、迁移失败或版本过高并暴露存储不可用状态；验证：人为使用不可读数据库文件时应用仍能进入抓取与预览链路
- [x] 1.4 v2 迁移：为 `articles` 增加 `theme_id` 与主题索引，兼容已有 v1 数据库；验证：新库 `user_version = 4`，v1/v2 库升级后主题字段存在且文章数据保留
- [x] 1.5 v3 迁移：把默认主题 id 从 `technical` 统一为 `default`，同步已有文章与 `theme.active` 偏好；验证：v2 库升级后默认主题引用为 `default`
- [x] 1.6 v4 迁移：为 `themes` 增加 `css`、`token_version` 与 `source_theme_id`；验证：新库与 v1–v3 旧库升级后 `user_version = 4`，主题字段可用

## 2. 类型与仓储

- [x] 2.1 将 ThemeToken 范围常量与校验从 `src/renderer/src/theme/tokens.ts` 迁到 `src/shared/theme.ts`，新增 `src/shared/store-types.ts` 定义 StoredArticle、StoredImage（不含 localPath，物理映射由缓存索引负责）、ThemeRecord 与偏好返回类型；验证：渲染层原入口保持兼容，主进程可复用校验，typecheck 通过
- [x] 2.2 实现偏好 `getPreference` / `setPreference`，value 使用 JSON 编解码，写入更新 `updated_at`；验证：缺失 key 返回 undefined 且不插入，重复写入只保留一条
- [x] 2.3 实现自定义主题 `listThemes` / `getTheme` / `createTheme` / `renameTheme` / `deleteTheme`，写入前调用 token 与 CSS 共享校验；验证：创建、改名、删除合法主题；同 id 覆盖、非法 token、非法 CSS、内置 id 与引用删除均被拒
- [x] 2.4 实现文章快照 `upsertArticle` / `getArticle` / `listArticles` / `touchArticle`；列表按 `MAX(COALESCE(last_visited_at, updated_at), updated_at) DESC` 排序，新建、重新提取与打开都排到顶部；首次 upsert 写入 `last_visited_at`，重新提取刷新 `updated_at`，touch 刷新 `last_visited_at` 并递增 `visit_count`，同一 hash 不新增；验证：新建后位于首位，重新提取与 touch 均回到首位，排序符合 spec
- [x] 2.5 在同一事务内实现 `replaceArticleImages`（先删旧图片集合再写当前集合），覆盖三态、尺寸与顺序；验证：重新提取图片变少后无残留，状态更新后文章其余字段不变，非法 status 被数据库拒绝
- [x] 2.6 实现 `deleteArticle` / `clearHistory`：只删文章与级联图片元数据，不删除 `article-cache/<hash>/`；验证：删除后图片记录清空、缓存目录仍在
- [x] 2.7 文章主题关联：`articles.theme_id` 默认 `default`，首次 upsert 写入，重新提取保留，`setArticleTheme` 只更新引用 id；验证：历史摘要携带主题，修改主题 id 后读取到新引用，主题快照不被改写

## 3. 验证与文档

- [x] 3.1 扩展 `scripts/verify-main.ts`，用临时数据库路径覆盖初始化、重复初始化、版本过高、v2–v4 迁移、偏好、主题快照校验、引用删除保护、文章/图片替换、文章主题关联、级联删除与损坏降级；验证：主进程 harness 全绿且不污染真实历史
- [x] 3.2 更新 `docs/design.md` 的存储边界与目录结构，把「不引库、JSON 文件」改为「SQLite 管结构化数据、图片仍走文件缓存」，并链接 `docs/local-store.md`；验证：grep 不再残留与实现冲突的旧存储描述
- [x] 3.3 更新 `theme-panel` 的依赖说明，明确主题/偏好仓储由 `local-store` 提供；`history-sidebar` 尚未创建，等其建立后再单独更新；验证：OpenSpec 严格校验通过
- [x] 3.4 运行 npm run typecheck、npm run lint 与 Prettier 检查；验证：全部通过
