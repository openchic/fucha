# local-store Specification

## Purpose
在主进程用 Electron 内置 `node:sqlite` 持久化文章快照、图片、主题与偏好，管理 schema 版本迁移；数据库损坏或版本高于代码支持范围时降级为不可用，且不阻断抓取与预览主链路。

## Requirements

### Requirement: 本地数据库初始化与版本迁移

系统 SHALL 在主进程使用 Electron 自带 `node:sqlite` 打开 `userData/app.db`，以 `PRAGMA user_version` 管理 schema 版本；首次创建 SHALL 建立当前 schema（v8），已有 v1–v7 库 SHALL 顺序迁移补齐文章主题字段、统一默认主题 id、增加主题字段、切换历史排序索引、收敛索引、统一书卷主题 id 并清理中间主题 id。数据库打开、迁移失败或 `user_version` 高于代码支持版本时，系统 SHALL 将存储标记为不可用，且不阻断抓取、提取与预览主链路。

#### Scenario: 首次创建当前数据库

- **WHEN** 用户数据目录中尚不存在 `app.db`
- **THEN** 系统创建数据库与当前四张表，并把 `user_version` 设置为 8

#### Scenario: v1 库升级

- **WHEN** 数据库已有文章且 `user_version = 1`
- **THEN** 系统在事务中为 `articles` 增加 `theme_id` 与主题索引，保留原有文章数据并升级到 8

#### Scenario: v2 库升级默认主题 id

- **WHEN** 数据库为 v2，文章或偏好使用 `technical`
- **THEN** 系统把默认主题 id 统一为 `default`，保留自定义主题 id 与文章数据，并继续升级到 v8

#### Scenario: v4 库升级排序索引

- **WHEN** 数据库为 v4，使用旧的访问活动排序索引
- **THEN** v5 迁移删除旧索引并建立 `articles_updated_idx`，文章数据保留

#### Scenario: v5 库升级索引

- **WHEN** 数据库为 v5
- **THEN** v6 迁移把 `articles_updated_idx` 扩为 `(updated_at DESC, created_at DESC)`，新增 `themes_sort_idx` 与唯一 `themes_name_idx`，删除 `articles_final_url_idx` 与 `article_images_url_idx`，文章与主题数据保留

#### Scenario: v6 库升级书卷主题 id

- **WHEN** 数据库为 v6，文章或偏好仍引用 `serif`
- **THEN** v7 迁移把书卷引用改为 `shujuan`，默认主题保持 `default`，同步来源主题与 `theme.active`，文章与主题数据保留

#### Scenario: v7 库清理中间主题 id

- **WHEN** 数据库为 v7，文章或偏好仍引用 `xueqing`
- **THEN** v8 迁移把这些引用统一回 `default`，文章与主题数据保留

#### Scenario: 重复初始化不重复建表

- **WHEN** 已存在 `user_version = 1` 的数据库再次初始化
- **THEN** 系统不重复创建表或索引，已有数据保持不变

#### Scenario: 数据库不可用

- **WHEN** 数据库无法打开或迁移失败
- **THEN** 系统记录存储不可用状态，抓取与预览仍可正常进行

#### Scenario: 数据库版本高于代码

- **WHEN** 数据库的 `user_version` 高于当前代码支持的版本
- **THEN** 系统不执行迁移，将存储标记为不可用并保持原库内容不变

### Requirement: 存储访问边界

SQLite 访问 SHALL 只存在于主进程，渲染进程 SHALL 只能通过 preload 暴露的领域方法使用存储能力，不得提交或执行任意 SQL。

#### Scenario: 渲染进程无数据库能力

- **WHEN** 历史栏或主题面板已接入
- **THEN** preload 只暴露领域方法，不暴露通用 SQL 或数据库对象，渲染进程不能直接访问 `app.db`

### Requirement: 偏好键值存储

系统 SHALL 在 `preferences` 表按唯一 key 保存 JSON 编码的偏好值，并记录更新时间；读取不存在的 key SHALL 返回空值而不创建记录。

#### Scenario: 写入后读取

- **WHEN** 主进程写入 `theme.active` 为 `default`
- **THEN** 随后读取同一 key 得到 `default`

#### Scenario: 重复写入更新

- **WHEN** 同一偏好 key 被再次写入新值
- **THEN** 表中仍只有一条记录，值与更新时间被替换

#### Scenario: 读取缺失偏好

- **WHEN** 查询一个从未写入的 key
- **THEN** 返回空值且不插入记录

### Requirement: 自定义主题存储

系统 SHALL 在 `themes` 表只保存用户自定义主题，内置主题继续由代码提供；主题 token 与 CSS SHALL 在写入前分别通过 `src/shared/theme.ts` 与 `src/shared/theme-css.ts` 的共享校验，读取结果 SHALL 仍是合法 ThemeToken。自定义主题 SHALL 支持原地更新：`updateTheme` 校验后更新 `token`、`css` 与 `updated_at`，引用该主题的文章同步使用新内容；`createTheme` 创建新 id，同 id 已存在时 SHALL 拒绝；名称、排序更新并同步 `updated_at`；内置 id SHALL 拒绝写入。删除仍被文章引用的主题 SHALL 被拒绝；删除来源主题时 SHALL 把其他主题的 `source_theme_id` 置空。

#### Scenario: 保存并列出自定义主题

- **WHEN** 主进程保存一份合法自定义主题
- **THEN** 主题列表返回该主题，token 可还原为合法 ThemeToken

#### Scenario: 非法主题被拒

- **WHEN** 主进程尝试保存一份越界或字段缺失的主题 token
- **THEN** 共享校验拒绝写入，表中不新增记录

#### Scenario: 拒绝重复创建

- **WHEN** 以已存在的主题 id 再次创建主题
- **THEN** 写入被拒绝，旧主题保持不变；更新内容必须走 `updateTheme`

#### Scenario: 原地更新

- **WHEN** 主进程收到合法 token 与 CSS 更新自定义主题
- **THEN** 同一 id 的 token、css 与 `updated_at` 更新，引用该主题的文章同步使用新内容

#### Scenario: 改名不改内容

- **WHEN** 用户在配置页修改自定义主题名称并保存
- **THEN** 只有名称与更新时间变化，token 与 css 不变

#### Scenario: 删除自定义主题

- **WHEN** 删除存在且未被文章引用的主题 id
- **THEN** 该主题不再出现在列表中

#### Scenario: 被引用的主题不能删除

- **WHEN** 删除仍被文章引用的主题
- **THEN** 删除被拒绝并报告引用数量

### Requirement: 文章快照与历史元数据

系统 SHALL 在 `articles` 表保存成功提取的文章快照，以 `SHA-256(finalUrl)` 前 32 位作为 hash；首次 upsert SHALL 写入 `last_visited_at` 与默认或指定的 `theme_id`（缺省 `default`），同一 hash 再次写入 SHALL 更新快照与 `updated_at`、保留已有 `theme_id` 且不产生重复记录。文章主题 SHALL 只存主题引用 id，不复制 token；自定义主题可原地编辑，引用它的文章 SHALL 同步使用新内容。列表 SHALL 按 `updated_at DESC, created_at DESC` 读取；新建与重新提取的文章 SHALL 排到顶部，打开文章 SHALL 不改变排序。`touch` SHALL 更新最近访问时间并递增访问次数，但不参与排序。

#### Scenario: 首次保存文章快照

- **WHEN** 主进程写入包含 hash、来源地址、最终地址、标题与净化正文的文章
- **THEN** 按 hash 可完整读回该快照，且 `last_visited_at` 已设置

#### Scenario: 重新提取同一文章

- **WHEN** 同一 finalUrl 的文章再次 upsert
- **THEN** 原记录被更新，不新增第二条记录

#### Scenario: 历史列表排序

- **WHEN** 存在多条文章且最近提取时间不同
- **THEN** 列表按 `updated_at DESC, created_at DESC` 返回

#### Scenario: 文章主题关联

- **WHEN** 一篇文章首次保存或修改主题
- **THEN** `articles.theme_id` 保存主题引用，重新提取保留已有主题，`setArticleTheme` 可更新引用 id

#### Scenario: 编辑主题同步文章

- **WHEN** 用户原地编辑主题 A
- **THEN** 引用 A 的文章同步使用新内容，主题 id 不变

#### Scenario: 另存为不修改源主题

- **WHEN** 用户基于主题 A 另存为主题 B
- **THEN** A 不变，B 为独立主题

#### Scenario: 新建文章排到顶部

- **WHEN** 主进程首次保存一篇文章快照
- **THEN** 该文章位于历史列表首位

#### Scenario: 重新提取回到顶部

- **WHEN** 主进程再次 upsert 一篇已有文章
- **THEN** `updated_at` 刷新，该文章回到历史列表首位

#### Scenario: 打开文章计数

- **WHEN** 主进程 touch 一个已存在 hash
- **THEN** 该文章的 `last_visited_at` 更新且 `visit_count` 加一，列表顺序不变

### Requirement: 图片元数据与级联删除

系统 SHALL 在 `article_images` 表按文章 hash 与图片 id 保存状态、尺寸与顺序；物理文件名 SHALL 继续由 `article-cache/<hash>/index.json` 作为唯一映射，数据库不保存 `local_path`。重新提取或下载状态变化时 SHALL 以完整图片集合替换该文章的旧记录。删除文章 SHALL 级联删除其图片元数据，但不删除缓存目录。

#### Scenario: 保存图片状态

- **WHEN** 文章快照携带 pending、done、failed 三态图片元数据
- **THEN** 读取文章时逐图状态、尺寸与顺序保持一致，文件映射从缓存索引解析

#### Scenario: 重新提取后图片集合变化

- **WHEN** 同一 hash 的新快照图片数量少于旧快照
- **THEN** 旧图片记录被完整替换，不留下已不存在的图片

#### Scenario: 下载状态更新

- **WHEN** 图片下载完成后主进程提交完整图片列表
- **THEN** 对应状态与尺寸被更新，文章其余字段不变

#### Scenario: 删除文章

- **WHEN** 删除一个文章 hash
- **THEN** 该文章的所有 `article_images` 记录同时消失，缓存目录保持不变

#### Scenario: 缓存索引缺失

- **WHEN** 数据库记录图片为 done，但缓存索引中没有对应文件
- **THEN** 快照消费方按失败占位处理，不回退为数据库内文件名

#### Scenario: 非法图片状态

- **WHEN** 尝试写入 CHECK 约束之外的图片状态
- **THEN** 数据库拒绝写入
