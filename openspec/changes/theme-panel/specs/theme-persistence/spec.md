## Purpose

把主题、文章主题绑定与默认主题偏好落成 SQLite 记录；主题是快照，历史文章不会因主题编辑而换样。

## ADDED Requirements

### Requirement: 不可变主题快照

自定义主题 SHALL 以 `token + css + token_version + source_theme_id` 保存；`token` 与 `css` 写入后 SHALL 不再修改。保存主题调整 SHALL 创建新 id，不覆盖旧行；同一 id 已存在时 SHALL 拒绝。只有名称、排序这类元信息允许更新，并同步 `updated_at`。

#### Scenario: 另存并复现

- **WHEN** 用户保存主题调整后重启应用
- **THEN** 新主题出现在列表，渲染效果与保存时一致，源主题未被修改

#### Scenario: 拒绝覆盖

- **WHEN** 使用已存在的主题 id 创建快照
- **THEN** 写入被拒绝，旧快照保持不变

#### Scenario: 改名不改内容

- **WHEN** 用户重命名自定义主题
- **THEN** 只有 `name` 与 `updated_at` 更新，token 与 css 不变

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

- **WHEN** 保存或导入 id 为 `default` 或 `serif` 的自定义主题
- **THEN** 操作被拒绝

#### Scenario: 存储降级

- **WHEN** 数据库不可用
- **THEN** 主题列表只有内置主题，预览与复制仍可用
