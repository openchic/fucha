## 1. 数据库与迁移

- [x] 1.1 新增 `src/main/db.ts`，用 Electron 自带 `node:sqlite` 打开数据库（默认 `userData/app.db`，支持测试注入路径），设置 WAL、foreign keys、busy timeout 与 `PRAGMA user_version` 检查；验证：临时路径首次初始化生成数据库文件，版本高于代码时判定不可用
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
- [x] 4.9 侧栏开关提示去掉「左侧栏」，只保留「展开 / 收起」与 ⌘B，`aria-label` 仍保留可读描述；验证：真实窗口收起与展开两种悬停截图

## 5. 首页输入页精修

- [x] 5.1 New 说明改为「把网页文章，妥帖地排进公众号」，占位改为「粘贴文章链接」，说明与输入框间距 36px → 24px；验证：真实窗口截图，`getBoundingClientRect` 量得间距 24px
- [x] 5.2 提交按钮始终可点、不置灰；空输入与非法地址在字段下方就地提示，焦点回到输入框；验证：真实窗口空态按钮为黑，空提交出现红字提示
- [x] 5.3 输入框焦点只显示主色边框，错误态改用危险色，不叠加光晕；提示位高度与错误行一致；验证：真实窗口聚焦与错误截图，错误出现前后 `fieldTop` 均为 354（位移 0）
- [x] 5.4 失败页改为内容列水平与垂直居中：警示图标在上，错误分类、原因与「重新尝试」「返回修改链接」依次居中排列，去掉信息带、分隔线与灰卡片；加载中取消与失败返回共用 `?url=` 回填原链接，抓取兜底文案改为中文；验证：1180/1000 宽度失败态截图，重试与返回可用，返回后输入框回填原链接
- [x] 5.5 输入区下方新增「落纸」出处与释义脚注：20px 细线 + 12px 次级文字 + 约 38em 短行，文案为杜甫《饮中八仙歌》「挥毫落纸如云烟」的典故；验证：真实窗口截图，脚注两行内结束且不与输入框抢焦点
- [x] 5.6 去掉输入区下方的名称出处脚注与细线，输入页只保留标题、说明与输入；验证：真实窗口截图确认脚注不再出现，首屏高度收紧

## 6. 更名落纸与标识解耦

- [x] 6.1 显示名改为「浮槎」：首页标题、窗口标题、安装包 productName 与菜单名；验证：真实窗口截图与菜单名
- [x] 6.2 代码标识通用化：`app://` 图片协议、`window.api` / `AppApi`、`--theme-*` 变量、`app.db`、`.article-theme` 主题包、`OPEN_DEVTOOLS`；验证：全库 grep 仅迁移代码保留旧标识
- [x] 6.3 未发布阶段不保留旧版数据迁移：数据目录固定为 `appData/fucha`，移除试迁移与旧主题包前缀兼容；schema v11 保留用于旧库主题 CSS 变量改写；验证：删除对应 harness 场景后主进程 harness 全绿，真实窗口数据正常

## 7. 应用壳墨黑灰蓝配色

- [x] 7.1 外壳 token 改为墨黑 #1d1d1f、烟灰蓝 #718096、雾白 #f8f9fa 与选中浅底 #eef1f4；不改布局和文章主题
- [x] 7.2 历史/设置导航、下拉和分段 tab 选中文字保持墨黑，灰蓝仅点缀选中图标、手机预览开关及输入焦点，保留错误/危险色
- [x] 7.3 真实 Electron 验证首页焦点、空值/非法输入、清空恢复、历史与设置导航、手机预览、下拉键盘、tab、数值步进恢复与取色器；选中文字为墨黑、图标为烟灰蓝，控制台无错误。三套主题正文计算样式、变量及预览/导出 CSS 与原始基线完全一致。灰蓝图标对选中底色 3.54:1、选中文字 14.85:1、次级文字对面板 4.59:1；typecheck、lint、Prettier、OpenSpec 严格校验与 154 项渲染回归检查通过
- [x] 7.4 统一历史列表与下拉选项的普通悬停、选中及选中悬停配色；真实 Electron 验证三种状态的计算背景色与文字色一致、移出恢复、更多按钮悬停与菜单正常、正文不变且控制台无错误；typecheck、Sidebar ESLint/Prettier 与 OpenSpec 严格校验通过
- [x] 7.5 选中悬停改为共用不透明 `accent-hover`（#eaecef）变量；真实窗口中三种状态的计算色与截图像素配对均一致，更多菜单、移出恢复与正文不变检查通过。截图含色彩配置，验证以相同解码流程比较两组件最终像素；typecheck、ESLint、Prettier 与 OpenSpec 严格校验通过
- [x] 7.6 左侧「新建」hover 复用 `raised` 底色与次级文字色；真实 Electron 验证与历史项计算色一致、移出恢复默认态、点击正常返回输入页且无运行时错误；ESLint、Prettier 与 OpenSpec 严格校验通过
- [x] 7.7 `ink` 引用 `primary`，`divider` 引用 `raised`，保留语义变量；统一剩余白色 hover 与侧栏开关焦点底色。真实 Electron 验证变量实值、主按钮、分隔线、设置/返回 hover 与恢复、侧栏开关键盘焦点和折叠展开、设置选中态与导航，无运行时错误；三套文章主题正文计算样式、变量与预览/导出 CSS 对比原始基线不变。typecheck、lint、Prettier 与 OpenSpec 严格校验通过

## 8. 历史列表紧凑密度

- [x] 8.1 历史项与左侧「新建」按钮总高同步改为 36px，上下内边距各 8px、行高 20px，保留 14px 字号和历史项间距 2px；独立真实 Electron 窗口验证尺寸、长标题省略、28px 更多按钮居中、菜单、选中、悬停、新建与文章切换，原正文不变且无运行时错误；typecheck、Sidebar ESLint/Prettier 与 OpenSpec 严格校验通过

## 9. 内容区轻阴影

- [x] 9.1 首页与设置页共用原有单层轻阴影 `shadow-panel`（向下 1px、模糊 2px、主色 5%）；补描边和完全去阴影两种尝试均被否决，最终保留单层阴影。真实 Electron 验证首页、文章与设置阴影一致，白色与16px圆角、弹层阴影、正文与几何不变，导航正常且无运行时错误；typecheck、ESLint、Prettier 与 OpenSpec 严格校验通过
