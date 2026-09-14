## Purpose

定义主题 token 的固定结构与单位约定，作为预览渲染与导出内联的共同数据源。token 是纯数据，预览、导出、持久化、生成共用同一形状。

## ADDED Requirements

### Requirement: 主题 token 固定结构

系统 SHALL 以固定结构的 ThemeToken 描述主题，按组组织：page（contentWidth 与 padding，仅预览用，导出不携带）、text（字号 px、行高倍数、字距 em、段距 px、正文色、次要色、强调色）、primary、heading（h1 至 h3 字号、对齐、装饰、装饰色、上下间距）、quote（背景、边条色、内距、圆角）、code（hljs 主题名、背景、字号、行高、内距、圆角）、table（表头背景、边框色、字号、单元格内距）、image（圆角、图注字号、间距）、divider（样式与色）、footnote（色、字号）。圆角按块分离。数值字段 SHALL 携带单位与取值范围（滑杆与校验共用边界），正文 fontSize 限定 15 至 17。

#### Scenario: 合法 token 通过校验

- **WHEN** 提供一份字段齐全、数值在约定范围内的 token
- **THEN** 校验通过，可用于渲染

#### Scenario: 越界被拒

- **WHEN** fontSize 为 10
- **THEN** 校验不通过并给出可读原因

#### Scenario: page 组不进导出

- **WHEN** 从 token 生成导出样式
- **THEN** contentWidth 与 padding 不出现在导出产物中

### Requirement: 内置预设可用

系统 SHALL 内置至少一套面向技术长文的预设主题，配色为中性（与应用壳配色无关），代码块与表格的视觉处理优先打磨；应用首次使用 SHALL 无需任何配置即以预设渲染。

#### Scenario: 零配置默认主题

- **WHEN** 应用首次启动进入预览
- **THEN** 预览以内置技术长文预设渲染

#### Scenario: 代码块与表格完整表达

- **WHEN** 正文包含代码块与表格
- **THEN** 预设对两者均有可辨识的视觉处理（背景、边条、表头色）
