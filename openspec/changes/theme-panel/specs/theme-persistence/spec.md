## Purpose

把自定义主题与使用偏好落成 userData 下的 JSON 文件，可管理、可迁移。

## ADDED Requirements

### Requirement: 自定义主题持久化

"另存为自定义主题" SHALL 把当前 token 写入 userData 目录的自定义主题存储；自定义主题 SHALL 支持重命名、删除、导出 JSON、导入 JSON，导入 SHALL 经结构校验。

#### Scenario: 另存并复现

- **WHEN** 用户调整主题后另存为自定义主题，重启应用
- **THEN** 该主题出现在主题列表且渲染效果与保存时一致

#### Scenario: 导入校验

- **WHEN** 导入一份结构不合法的 JSON
- **THEN** 导入被拒绝并给出可读错误

### Requirement: 偏好持久化

系统 SHALL 记住上次使用的主题，下次启动默认以其渲染；会话内临时调整不写入偏好。

#### Scenario: 记住上次主题

- **WHEN** 上次使用自定义主题 A 后退出，再次启动
- **THEN** 应用默认以主题 A 渲染

### Requirement: 内置预设不可变

内置预设 SHALL 不可被删除或覆盖；对预设的调整 SHALL 经"另存为"成为自定义主题。

#### Scenario: 预设保护

- **WHEN** 用户尝试删除内置预设
- **THEN** 操作被拒绝
