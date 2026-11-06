## Purpose

让主题可以离开应用：导出成单个主题包，导入后成为自定义主题；坏包与不安全 CSS 在导入时整包拒绝。

## ADDED Requirements

### Requirement: 主题包格式

主题包 SHALL 是一个 `.fucha-theme` zip，只包含 `theme.json` 与 `theme.css`。`theme.json` SHALL 包含 `id`、`name`、`version`、`tokenVersion` 与完整 `token`；`id` 与 `name` SHALL 与 `token.id`、`token.name` 一致。`tokenVersion` SHALL 等于当前支持的版本。

#### Scenario: 导出主题

- **WHEN** 用户导出自定义主题
- **THEN** 生成包含两个文件的 zip，token 与 css 与保存时一致

#### Scenario: 内置主题导出

- **WHEN** 用户导出内置主题
- **THEN** 包内 token 的 `builtin` 为 false，导入后成为普通自定义主题

#### Scenario: 不导出文章

- **WHEN** 导出主题
- **THEN** 包内不包含文章正文、图片或来源信息

### Requirement: 导入 fail-closed 校验

导入 SHALL 拒绝以下任一情况并给出可读原因：zip 加密、zip64、路径穿越、条目超限、缺少或多余文件、文件校验失败、JSON 非法、id/name 不一致、内置 token、token 版本不支持、token 校验失败、CSS 校验失败、id 与内置或已有主题冲突。任何一条失败 SHALL 不写入存储。

#### Scenario: 坏 CSS 拒绝

- **WHEN** `theme.css` 含伪类、`@` 规则、`!important`、外部资源或契约外变量
- **THEN** 导入失败并报告出错行号与原因，存储不新增主题

#### Scenario: 根节点规则

- **WHEN** `theme.css` 单独使用 `&` 写入根节点声明
- **THEN** 导入通过，规则作用于预览根与导出外层 section

#### Scenario: id 冲突

- **WHEN** 导入主题 id 已存在于自定义主题或内置主题
- **THEN** 导入被拒绝

#### Scenario: 多余文件

- **WHEN** 包内除 `theme.json` 与 `theme.css` 外还有文件
- **THEN** 导入被拒绝

### Requirement: 导入结果

导入成功后 SHALL 把主题写入自定义主题表并刷新列表，SHALL 不自动切换当前文章主题。

#### Scenario: 导入后可选

- **WHEN** 导入成功
- **THEN** 新主题出现在下拉与设置页主题列表，当前文章主题不变
