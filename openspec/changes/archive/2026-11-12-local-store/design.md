## Context

当前应用只在 `userData/article-cache/<hash>/` 保存图片，主题与偏好尚未持久化。历史侧栏、自定义主题与偏好设置都需要结构化本地存储，继续按功能分别写 JSON 会形成多套写入、查询和迁移逻辑。表结构已在 `docs/local-store.md` 确认，本 change 只实现存储底座。

## Goals / Non-Goals

**Goals:**

- 用 Electron 自带 `node:sqlite` 建立单一 SQLite 数据文件。
- 实现 v1 schema、`PRAGMA user_version` 迁移与主进程仓储。
- 为历史与主题后续功能提供可测试的 preferences/themes/articles/article_images 数据能力。
- 数据库失败时保持抓取、提取、预览主链路可用。

**Non-Goals:**

- 历史分页、全文搜索与跨设备同步。
- 通用 SQL 或数据库对象暴露给渲染进程。
- 全局缓存孤儿清理。

## Decisions

**使用 `node:sqlite`，不用 `better-sqlite3`。** 当前 Electron 39 自带 Node 22.22.1，已验证 SQLite 3.51.2 与 FTS5；内置驱动不引入原生编译与打包链路。代价是 experimental API，因此数据库访问集中在 `src/main/db.ts`，升级 Electron 时以主进程 harness 冒烟。备选 `better-sqlite3` API 更稳定，但需要 Electron ABI 重建，收益不足以抵消成本。

**文章正文存 SQLite，图片字节仍存文件系统。** 正文是打开快照的主数据，放进 `articles.html` 可让一次读取完成；图片可能很大且已有 `app://` 协议，数据库只存 `article_images` 元数据。备选把图片转 BLOB 会膨胀数据库并绕开现有缓存。

**主进程 repository，IPC 只暴露领域方法。** `src/main/store.ts` 暴露类型化函数，`ipc.ts` 按历史栏与主题面板的真实需求接 `themes:*`、`articles:*`、`preferences:*` 频道；渲染进程不提交 SQL，也不拿数据库对象。

**版本只存 `PRAGMA user_version`。** 不建 `schema_meta` 表；当前 schema 为 v8：v1 建表，v2 增加文章主题字段与索引，v3 把默认主题 id 从 `technical` 统一为 `default` 并更新已有文章与偏好，v4 为 `themes` 增加 `css`、`token_version` 与 `source_theme_id`，v5 把历史排序索引从访问活动改为 `updated_at`，v6 收敛索引，v7 把书卷主题 id 从 `serif` 统一为 `shujuan`，v8 清理中间态 `xueqing`，默认主题保持 `default`。未来迁移继续按版本顺序执行。代价是没有迁移审计时间，当前应用不需要。

**主题表只存自定义主题，校验提升到 shared。** 内置主题留在代码，避免代码与数据库两份来源。ThemeToken 校验在 `src/shared/theme.ts`，主题 CSS 契约校验在 `src/shared/theme-css.ts`；主进程写入前同时校验 token 与 CSS，渲染层使用同一入口。

**图片元数据按集合替换，文件映射只留 index.json。** 重新提取时先删该 hash 的旧 `article_images` 再写当前集合，避免旧图残留；下载状态变化提交完整图片列表。数据库不存 `local_path`，物理文件名仍由 `article-cache/<hash>/index.json` 唯一负责，快照消费方按 hash 读取映射，缺失即按失败占位。

**删除历史只删数据库行。** 当前预览与导出可能正在使用缓存文件，直接删目录会产生竞态和裂图；当前版本只删 `articles` 与级联的 `article_images`，缓存清理留给后续有「无活跃预览」前提的清理任务。

**历史排序按最近提取时间，不按访问活动。** 列表使用 `updated_at DESC, created_at DESC`：新建与重新提取刷新 `updated_at`，因此回到顶部；打开文章只更新 `last_visited_at` 与 `visit_count`，不改变排序。排序由 `articles_updated_idx(updated_at DESC, created_at DESC)` 完整覆盖，v6 迁移收敛索引后不再产生临时排序；`final_url` 与 `article_images.original_url` 没有查询消费者，对应索引一并移除。

**文章主题只存引用 id，不存 token。** `articles.theme_id` 默认 `default`；首次 upsert 写入当前选择的主题，重新提取保留文章原主题，`setArticleTheme` 只更新引用 id。自定义主题可原地编辑，引用它的文章同步换样；删除仍被文章引用的主题会被拒绝，消费方读取到未知 id 时回退默认主题但保留原引用。

**测试使用可注入的数据库路径。** `initLocalStore(dbPath?)` 默认取 `userData/app.db`，harness 传入临时路径，避免污染真实历史。`user_version` 高于代码支持版本时不迁移，直接判定存储不可用。

**启动失败采用降级。** `initLocalStore()` 返回可用状态；失败时历史/主题仓储抛明确错误，但不让 `app.whenReady()` 失败。抓取与预览不依赖数据库。

**历史打开优先读本地快照。** 历史栏点击用 `?hash=` 打开 `getArticle` 的 HTML 与图片元数据，不重新抓取；图片按缓存索引映射，缓存缺失时回退占位。打开时 `touchArticle` 更新最近访问与次数，列表顺序不变。`重新提取` 才走网络并 upsert 新快照，主题引用保持不变。

**Home 布局固定 264px 左侧历史栏。** 与右侧 724px 正文列相加仍能在 1000px 最小窗口内放下；列表独立滚动，输入页与文章预览之间切换只替换右侧 Outlet 内容。历史切换与「新建」直接执行，主题编辑的未保存确认只属于设置页。

**启动窗口不超出屏幕可用区域。** 创建窗口时读取主屏 `workAreaSize`，宽高分别取 1200×800 与可用区域的较小值；最小尺寸仍为 1000×700，仅约束用户手动缩放。不做窗口位置与尺寸记忆，避免多显示器变化后的陈旧值。该逻辑只影响初始 bounds，不改侧栏折叠、全屏偏移或内容布局。

**右侧内容区共用单层轻阴影。** 首页与设置页白色容器统一使用 `shadow-panel`：向下偏移 1px、模糊 2px、主色透明度 5%。曾尝试补四周描边来强化上缘，但描边显得刻意，最终保留原有的单层轻阴影。阴影在 `tokens.css` 通过 `--shadow-panel` 定义并引用 `primary`，不重复硬编码灰色；保留 16px 圆角与既有布局，弹层阴影、手机设备外框和文章主题不变。

**历史列表保持紧凑单行密度。** 历史项与左侧「新建」按钮均使用 14px 字号、20px 行高与上下各 8px 内边距，总高 36px；历史项间距仍为 2px，更多按钮维持 28px 并垂直居中。不调整标题区域、宽度、配色或文章预览。

**New 输入页只承诺「排版」，不承诺「发布」。** 页面只保留链接输入框，不展示品牌字标与说明，避免任何「直接发进公众号」的暗示；空输入、空白与格式错误的地址都走就地错误提示，不靠禁用按钮表达不可用。焦点只保留 1px 烟灰蓝边框，错误态改用危险色，不叠加光晕；提示位状态切换不改变输入框位置。抓取或提取失败在右侧内容列居中展示失败分类、具体原因与「重新尝试」「返回修改链接」，不设信息带、分隔线或卡片，错误色只出现在警示图标上；返回与 LoadingPanel 的取消共用 `/?url=` 路径，避免抓取失败后链接丢失。

**名称出处不进入首页。** 输入页只保留标题、说明与输入，名称的典故留在 README 与设计文档里；脚注会与输入动作争夺注意力，且首屏留白本身已经足够安静。

**更名与代码标识解耦。** 品牌名只进界面与安装包：`app.setName('浮槎')` 与 productName 管显示名；包名、appId 与可执行文件名统一为 `fucha`；代码标识统一为通用名（`app://`、`window.api` / `AppApi`、`--theme-*`、`app.db`、`.article-theme`、`OPEN_DEVTOOLS`），避免再次更名牵动协议与存储。数据目录固定为 `appData/fucha`；未发布阶段不保留旧品牌目录迁移与旧主题包前缀兼容，schema v11 继续用于旧库主题 CSS 的变量前缀改写。

**墨黑与烟灰蓝只属于应用壳。** 主按钮与主要文字用墨黑 `#1d1d1f`，强调色为烟灰蓝 `#718096`，选中底色为极浅灰蓝 `#eef1f4`，面板底色为雾白 `#f8f9fa`。烟灰蓝仅用于选中图标与焦点细线，历史、导航、下拉、分段控件的选中文字保持墨黑，避免大面积彩色文字抢走内容层级；危险色保持红色，不改布局、字体和动效。烟灰蓝不用作正文或白字按钮底色，图标与焦点按 3:1 对比度验证，正文仍按 4.5:1 验证。左侧「新建」、历史列表与下拉选项统一使用 `raised` 普通悬停底色；历史列表与下拉选项使用 `accent-soft` 选中底色与不透明 `accent-hover`（`#eaecef`）选中悬停底色；半透明色会分别与侧栏和弹层底色混合，因此仅比较 CSS 计算值不足以证明视觉一致，需对真实窗口截图取样验证。手机预览开关复用同一选中悬停变量；普通悬停保留次级文字色，选中文字保持墨黑。历史项保留整行 `group-hover`，鼠标经过更多按钮时不丢失行悬停。颜色由 `styles/tokens.css` 的 `--color-*` 管理；`ink` 引用 `primary`，`divider` 引用 `raised`（`#f2f4f6`），合并色值而保留语义变量。侧栏设置、设置页返回与未选中导航、侧栏开关的普通悬停底色统一为 `raised`，侧栏开关的键盘焦点底色同步；`panel`、`line`、`accent-soft` 与 `accent-hover` 保留各自层次。文章正文继续仅由 `--theme-*`、ThemeToken 与 theme.css 决定，不改主题预设、已保存数据或导出逻辑；用三套主题改色前后的计算样式和生成 CSS 对比验证隔离。

## Risks / Trade-offs

- [`node:sqlite` experimental] → 集中封装、固定 Electron 版本、升级跑 harness；数据库失败不阻断主链路。
- [文章 HTML 增大数据库] → 只存净化正文，图片不进库；后续可加保留策略，不在 v1 猜测阈值。
- [图片状态与缓存映射不一致] → 数据库只存状态，`index.json` 是物理映射唯一来源；索引缺失按失败占位。
- [删除历史与预览/导出的竞态] → v1 只删数据库行，缓存目录清理放到后续独立任务。
- [并发写入] → Electron 主进程单线程调用仓储，SQLite WAL 处理文件级并发；不使用渲染进程直连。
- [数据库损坏或版本过高] → 初始化捕获异常并降级；不迁移高于代码版本的库，v1 无历史数据可迁移，损坏时允许重建空库。

## Migration Plan

新增文件与启动初始化，不迁移既有 JSON。回滚时移除 `src/main/db.ts`、`src/main/store.ts`、`src/shared/store-types.ts`、`src/shared/theme.ts` 与启动调用；`userData/app.db` 可安全删除，图片缓存不受影响。

## Open Questions

无。表结构、驱动与后续 change 边界已在对话中确认。
