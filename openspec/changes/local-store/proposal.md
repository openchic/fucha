## Why

历史侧栏、自定义主题与偏好设置都需要跨重启保存结构化数据。继续用多个 JSON 文件会分散写入、查询和迁移逻辑，也難以支持文章快照与图片元数据的一致性；现在建立统一的 SQLite 数据底座，可让后续功能复用同一套存储边界。

## What Changes

- 新增主进程 SQLite 存储层，使用 Electron 自带 `node:sqlite`，不增加 npm 原生依赖。
- 建立并迁移到 v6 schema：`preferences`、`themes`、`articles`、`article_images`，版本由 `PRAGMA user_version` 管理；v4 为主题表补齐 `css`、`token_version` 与 `source_theme_id`，v5 把历史排序改为最近提取时间，v6 收敛索引（复合历史排序、主题排序与名称唯一）并移除无消费者索引。
- 新增主进程领域仓储：偏好读写、自定义主题的创建/更新/读取/改名/删除、文章快照 upsert/读取/删除、图片集合替换与历史列表查询。
- 将 ThemeToken 校验从渲染层提升到 `src/shared/theme.ts`，主进程写入主题前即可复用。
- 文章与图片在同一事务写入；图片文件映射继续由缓存 `index.json` 唯一负责，数据库不保存本地文件名。
- 删除历史只删数据库行与图片元数据，不删除缓存目录，避免影响当前预览或导出。
- 数据库损坏、迁移失败或 `user_version` 高于代码支持版本时，历史与主题功能降级为不可用，抓取、提取和预览主链路仍可启动。
- 新增 Home 布局左侧历史栏：读取文章摘要、打开本地快照、访问计数与排序刷新；右侧承载 New 输入页与 Preview 文章页；主题/文章领域 IPC 由界面按需接入。
- 本 change 不做全文搜索、历史分页或跨设备同步。

## Capabilities

### New Capabilities

- `local-store`: 本地 SQLite 数据库初始化、schema 迁移、偏好/主题/文章快照仓储与失败降级。
- `history-sidebar`: 预览页左侧历史列表、快照打开、访问计数与网络刷新。

### Modified Capabilities

（无。现有抓取、提取、图片缓存与预览行为不变。）

## Impact

- 新代码：`src/main/db.ts`、`src/main/store.ts`、`src/shared/store-types.ts`、`src/shared/theme.ts`。
- 启动流程：主进程 app ready 后初始化数据库；现有 `registerIpcHandlers()` 暂不暴露存储 API。
- 验证：扩展 `scripts/verify-main.ts`，使用临时数据库路径覆盖建库、迁移幂等、偏好、主题、文章/图片替换、级联删除与损坏/版本回退降级。
- 后续 change：`history-sidebar` 消费文章快照仓储并增加 IPC/UI；`theme-panel` 消费主题与偏好仓储。
- 设计依据：`docs/local-store.md`。
