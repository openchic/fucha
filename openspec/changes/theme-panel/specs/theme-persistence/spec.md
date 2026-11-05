## Purpose

把主题、文章主题绑定与默认主题偏好落成 SQLite 记录；内置主题只读，自定义主题可原地编辑，编辑后引用该主题的文章同步换样。

## ADDED Requirements

### Requirement: 可编辑的自定义主题

自定义主题 SHALL 以 `token + css + token_version + source_theme_id` 保存。`updateTheme` SHALL 校验 token 与 CSS 后更新同一 id 的 `name`、`token`、`css` 与 `updated_at`，引用该主题的所有文章 SHALL 使用新内容；另存为与新建 SHALL 通过 `createTheme` 生成新 id，同一 id 已存在时拒绝。内置 id SHALL 拒绝写入。主题名称 SHALL 全局唯一（含内置主题，不区分英文大小写）；`createTheme` 与改名保存遇到重名 SHALL 拒绝，未改名的已有主题仍可保存。配置页改名 SHALL 随保存提交，只改名时除 `name` 与 `updated_at` 外内容不变。

#### Scenario: 原地保存同步文章

- **WHEN** 用户编辑自定义主题并保存
- **THEN** 主题 id 不变，token 与 css 更新，所有引用它的文章同步使用新内容

#### Scenario: 另存并复现

- **WHEN** 用户另存为并重启应用
- **THEN** 新主题出现在列表，渲染效果与保存时一致，源主题未被修改

#### Scenario: 拒绝覆盖创建

- **WHEN** 使用已存在的主题 id 创建主题
- **THEN** 写入被拒绝，旧主题保持不变

#### Scenario: 改名不改内容

- **WHEN** 用户在配置页修改主题名称并保存
- **THEN** `name` 与 `updated_at` 更新，token 与 css 内容不变

#### Scenario: 拒绝重名

- **WHEN** 新建、导入或改名后的主题名称已被其他主题或内置主题占用
- **THEN** 写入被拒绝，原记录保持不变

### Requirement: 主题引用与删除保护

文章 SHALL 只保存 `theme_id`，切换主题只更新 `articles.theme_id`。删除主题前 SHALL 检查文章引用；存在引用时 SHALL 拒绝删除并报告引用数量，不静默回退。删除来源主题时 SHALL 把其他主题的 `source_theme_id` 置空。

#### Scenario: 文章记住自己的主题

- **WHEN** 用户为文章 A 选择主题 B 后离开，再次打开文章 A
- **THEN** 文章 A 以主题 B 渲染

#### Scenario: 被引用时不能删除

- **WHEN** 主题仍被至少一篇文章引用
- **THEN** 删除被拒绝，主题与文章保持不变

#### Scenario: 删除来源

- **WHEN** 一个主题被删除且它是其他主题的来源
- **THEN** 其他主题的 `source_theme_id` 置空，主题本身保留

### Requirement: 默认主题偏好

系统 SHALL 记住上次使用的主题，作为下一篇新提取文章的默认主题；文章自己的 `theme_id` 不受该偏好覆盖。恢复历史文章时 SHALL 优先使用文章自己的主题，主题不存在时回退 `default` 且不改写存储值。

#### Scenario: 新文章使用默认主题

- **WHEN** 上次使用自定义主题 A 后退出，再次启动并提取新文章
- **THEN** 新文章默认使用主题 A

#### Scenario: 未知主题回退

- **WHEN** 文章指向的内置或自定义主题不存在
- **THEN** 预览回退 `default` 渲染，文章存储的 `theme_id` 保持不变

### Requirement: 内置主题不写库

内置主题 SHALL 继续由代码提供，不写入 `themes` 表；自定义主题 id SHALL 不能与内置 id 冲突。数据库不可用时 SHALL 只使用内置主题，抓取、预览与导出主链路仍可运行。

#### Scenario: 内置 id 保护

- **WHEN** 保存、更新或导入 id 为 `default`、`serif` 或 `danxia` 的自定义主题
- **THEN** 操作被拒绝

#### Scenario: 存储降级

- **WHEN** 数据库不可用
- **THEN** 主题列表只有内置主题，预览与复制仍可用
