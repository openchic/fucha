## Purpose

定义主题 token 的固定结构与单位约定，作为预览渲染与导出内联的共同数据源。token 是纯数据，预览、导出、持久化、生成共用同一形状。

## ADDED Requirements

### Requirement: 主题 token 固定结构

系统 SHALL 以固定结构的 ThemeToken 描述主题：颜色（primary、text、muted、background、codeBackground）、排版（fontSize px、lineHeight 倍数、letterSpacing em、paragraphSpacing px）、标题（对齐与装饰）、块级（引用背景与边条色、代码主题名、表头背景）、装饰（圆角 px、分割线样式）。所有数值字段 SHALL 携带单位约定，正文 fontSize 限定 15 至 17。

#### Scenario: 合法 token 通过校验

- **WHEN** 提供一份字段齐全、数值在约定范围内的 token
- **THEN** 校验通过，可用于渲染

#### Scenario: 越界被拒

- **WHEN** fontSize 为 10
- **THEN** 校验不通过并给出可读原因

### Requirement: 内置预设可用

系统 SHALL 内置至少一套面向技术长文的预设主题，代码块与表格的视觉处理优先打磨；应用首次使用 SHALL 无需任何配置即以预设渲染。

#### Scenario: 零配置默认主题

- **WHEN** 应用首次启动进入预览
- **THEN** 预览以内置技术长文预设渲染

#### Scenario: 代码块与表格完整表达

- **WHEN** 正文包含代码块与表格
- **THEN** 预设对两者均有可辨识的视觉处理（背景、边条、表头色）
