## Purpose

让用户能更换主题并在面板中逐项微调 token，改动实时反映到预览，形成"所见即所得"的调参闭环。

## ADDED Requirements

### Requirement: 主题切换

面板 SHALL 提供内置预设与自定义主题的切换，切换即时生效于预览。

#### Scenario: 切换预设

- **WHEN** 用户在面板选择另一套主题
- **THEN** 预览立即以新主题渲染

### Requirement: 逐项编辑 token

面板 SHALL 支持逐项调整 token：颜色项用取色器，数值项用滑杆（限定各字段取值范围），改动实时反映到预览，无需确认步骤。

#### Scenario: 调色实时反映

- **WHEN** 用户拖动取色器修改主色
- **THEN** 预览中对应颜色即时更新

#### Scenario: 数值限定范围

- **WHEN** 滑杆调整 fontSize
- **THEN** 取值被限定在约定范围内（15 至 17）

### Requirement: 会话内临时调整

未保存的调整 SHALL 在会话内持续生效，SHALL 不自动写入持久化；切换主题或离开时 SHALL 提示未保存或将调整并入当前自定义主题。

#### Scenario: 不落盘

- **WHEN** 用户调整后直接关闭应用
- **THEN** 该调整未被写入自定义主题存储
