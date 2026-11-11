## Why

历史侧栏、自定义主题与偏好设置都需要跨重启保存结构化数据。继续用多个 JSON 文件会分散写入、查询和迁移逻辑，也難以支持文章快照与图片元数据的一致性；现在建立统一的 SQLite 数据底座，可让后续功能复用同一套存储边界。

## What Changes

- 新增主进程 SQLite 存储层，使用 Electron 自带 `node:sqlite`，不增加 npm 原生依赖。
- 建立并迁移到 v8 schema：`preferences`、`themes`、`articles`、`article_images`，版本由 `PRAGMA user_version` 管理；v4 为主题表补齐 `css`、`token_version` 与 `source_theme_id`，v5 把历史排序改为最近提取时间，v6 收敛索引（复合历史排序、主题排序与名称唯一）并移除无消费者索引，v7 统一书卷主题 id，v8 清理中间主题 id。
- 新增主进程领域仓储：偏好读写、自定义主题的创建/更新/读取/改名/删除、文章快照 upsert/读取/删除、图片集合替换与历史列表查询。
- 将 ThemeToken 校验从渲染层提升到 `src/shared/theme.ts`，主进程写入主题前即可复用。
- 文章与图片在同一事务写入；图片文件映射继续由缓存 `index.json` 唯一负责，数据库不保存本地文件名。
- 删除历史只删数据库行与图片元数据，不删除缓存目录，避免影响当前预览或导出。
- 数据库损坏、迁移失败或 `user_version` 高于代码支持版本时，历史与主题功能降级为不可用，抓取、提取和预览主链路仍可启动。
- 新增 Home 布局左侧历史栏：读取文章摘要、打开本地快照、访问计数与排序刷新；右侧承载 New 输入页与 Preview 文章页；主题/文章领域 IPC 由界面按需接入。
- New 输入页精修：说明改为「把网页文章，妥帖地排进公众号」，不再暗示自动发布到公众号；占位改为「粘贴文章链接」；说明与输入框间距由 36px 收到 24px；空输入时提交按钮禁用；输入框焦点显示与 NumberInput 一致的主色边框与 3px 16% 光晕；输入区下方以脚注形式补充「落纸」出处与释义；加载中取消与失败返回都通过 `?url=` 回到输入页并回填原链接，失败面板增加「返回修改链接」。
- 应用更名「落纸」并与代码标识解耦：显示名、窗口标题与安装包 productName 用落纸；图片协议改 `app://`、preload 命名空间改 `window.api`、主题变量改 `--theme-*`、数据库改 `app.db`、主题包改 `.article-theme`；旧 userData 一次性迁移，schema v11 改写已存主题 CSS 的变量前缀，旧 `.fucha-theme` 主题包导入时改写前缀。
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
