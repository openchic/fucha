## 1. 数据库与迁移

- [x] 1.1 新增 `src/main/db.ts`，用 Electron 自带 `node:sqlite` 打开数据库（默认 `userData/fucha.db`，支持测试注入路径），设置 WAL、foreign keys、busy timeout 与 `PRAGMA user_version` 检查；验证：临时路径首次初始化生成数据库文件，版本高于代码时判定不可用
- [x] 1.2 实现 v1 建表 SQL（preferences、themes、articles、article_images 及索引，含 JSON、长度、状态与计数 CHECK）；验证：连续初始化两次不重复建表，已有数据保留，非法 JSON/状态被拒
- [x] 1.3 在主进程启动流程调用 `initLocalStore()`，捕获打开、迁移失败或版本过高并暴露存储不可用状态；验证：人为使用不可读数据库文件时应用仍能进入抓取与预览链路
- [x] 1.4 v2 迁移：为 `articles` 增加 `theme_id` 与主题索引，兼容已有 v1 数据库；验证：新库 `user_version = 5`，v1/v2 库升级后主题字段存在且文章数据保留
- [x] 1.5 v3 迁移：把默认主题 id 从 `technical` 统一为 `default`，同步已有文章与 `theme.active` 偏好；验证：v2 库升级后默认主题引用为 `default`
- [x] 1.6 v4 迁移：为 `themes` 增加 `css`、`token_version` 与 `source_theme_id`；验证：v1–v3 旧库升级后主题字段可用
- [x] 1.7 v5 迁移：删除 `articles_activity_idx`，新建 `articles_updated_idx(updated_at DESC)`；验证：新库与旧库升级后 `user_version = 5`，旧索引不存在
- [x] 1.8 v6 索引优化：`articles_updated_idx` 扩为 `(updated_at DESC, created_at DESC)`，新增 `themes_sort_idx` 与唯一 `themes_name_idx`，删除无消费者的 `articles_final_url_idx`、`article_images_url_idx`；连接补 `synchronous = NORMAL` 与迁移后 `PRAGMA optimize`；验证：新库 `user_version = 6`，历史列表查询计划走复合索引且无临时排序
- [x] 1.9 v7 书卷主题 id 迁移：`serif` → `shujuan`，默认主题保持 `default`，同步 `articles.theme_id`、`themes.source_theme_id` 与 `theme.active` 偏好；验证：v6 库升级后书卷引用与偏好指向 `shujuan`，默认主题引用不变
- [x] 1.10 v8 中间主题 id 清理：`xueqing` → `default`，同步 `articles.theme_id`、`themes.source_theme_id` 与 `theme.active` 偏好；验证：v7 库升级后中间 id 统一回默认主题

## 2. 类型与仓储

- [x] 2.1 将 ThemeToken 范围常量与校验从 `src/renderer/src/theme/tokens.ts` 迁到 `src/shared/theme.ts`，新增 `src/shared/store-types.ts` 定义 StoredArticle、StoredImage（不含 localPath，物理映射由缓存索引负责）、ThemeRecord 与偏好返回类型；验证：渲染层原入口保持兼容，主进程可复用校验，typecheck 通过
- [x] 2.2 实现偏好 `getPreference` / `setPreference`，value 使用 JSON 编解码，写入更新 `updated_at`；验证：缺失 key 返回 undefined 且不插入，重复写入只保留一条
- [x] 2.3 实现自定义主题 `listThemes` / `getTheme` / `createTheme` / `updateTheme` / `deleteTheme`，写入前调用 token 与 CSS 共享校验；验证：创建、更新（含改名）、删除合法主题；同 id 覆盖、非法 token、非法 CSS、内置 id 与引用删除均被拒
- [x] 2.4 实现文章快照 `upsertArticle` / `getArticle` / `listArticles` / `touchArticle`；列表按 `updated_at DESC` 排序，新建与重新提取排到顶部，touch 不改变排序；首次 upsert 写入 `last_visited_at`，重新提取刷新 `updated_at`，touch 刷新 `last_visited_at` 并递增 `visit_count`，同一 hash 不新增；验证：新建后位于首位，重新提取回到首位，touch 后顺序不变、访问次数递增
- [x] 2.5 在同一事务内实现 `replaceArticleImages`（先删旧图片集合再写当前集合），覆盖三态、尺寸与顺序；验证：重新提取图片变少后无残留，状态更新后文章其余字段不变，非法 status 被数据库拒绝
- [x] 2.6 实现 `deleteArticle` / `clearHistory`：只删文章与级联图片元数据，不删除 `article-cache/<hash>/`；验证：删除后图片记录清空、缓存目录仍在
- [x] 2.7 文章主题关联：`articles.theme_id` 默认 `default`，首次 upsert 写入，重新提取保留，`setArticleTheme` 只更新引用 id；验证：历史摘要携带主题，修改主题 id 后读取到新引用，主题内容不被改写

## 3. 验证与文档

- [x] 3.1 扩展 `scripts/verify-main.ts`，用临时数据库路径覆盖初始化、重复初始化、版本过高、v2–v8 迁移、偏好、主题创建与更新校验、引用删除保护、文章/图片替换、文章主题关联、级联删除与损坏降级；验证：主进程 harness 全绿且不污染真实历史
- [x] 3.2 更新 `docs/design.md` 的存储边界与目录结构，把「不引库、JSON 文件」改为「SQLite 管结构化数据、图片仍走文件缓存」，并链接 `docs/local-store.md`；验证：grep 不再残留与实现冲突的旧存储描述
- [x] 3.3 更新 `theme-panel` 的依赖说明，明确主题/偏好仓储由 `local-store` 提供；历史栏读取路径同步写入本 change；验证：OpenSpec 严格校验通过
- [x] 3.4 运行 npm run typecheck、npm run lint 与 Prettier 检查；验证：全部通过

## 4. 历史侧栏

- [x] 4.1 暴露 `articles:list` IPC，渲染层新增 `useArticleHistory`；验证：列表按最近提取时间排序，打开历史不改变顺序，存储不可用时返回空列表并提示
- [x] 4.2 新增 `Sidebar`：固定 264px，列表项单行标题、超出省略，不展示来源与时间；当前文章高亮，空态/读取中/不可用态齐全
- [x] 4.3 快照打开：历史项带 `?hash=`，优先静默读取本地快照、不闪加载骨架；快照缺失回退网络；打开后 `touchArticle` 刷新访问次数与排序
- [x] 4.4 重新提取：快照视图原地走网络抓取并 upsert 新快照，保留当前正文、左侧栏与文章主题
- [x] 4.5 真实 Electron 验收：两篇文章提取后进入历史栏，停掉源站仍可打开快照，访问计数与排序正确，快照刷新更新正文
- [x] 4.6 页面拆分：Home 布局 + 嵌套路由 + 右侧 Outlet，`/` index 为 New 输入页、`/preview` 为文章页；左侧历史栏常驻，切换不重建
- [x] 4.8 历史项悬停更多菜单：更多按钮、删除、删除确认、当前文章删除后回 Home 页、失败提示；只删数据库行，缓存保留
