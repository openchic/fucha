## ADDED Requirements

### Requirement: Rspress 代码块标题归一

已确认的用户可见现象是 Rspress 站点文章的代码块文件名在预览中变成代码块上方的一段普通正文，与代码块失去关联。根因是标题位于 `.rp-codeblock__title` 容器内，Readability 与净化会拆掉容器与 class，标题只剩裸文本。提取 SHALL 在 Readability 之前识别 Rspress 代码块标记，把带标题的块归一为通用结构：`figure.code-block` 包裹 `figcaption`（标题文本）与 `pre > code`；无标题的块 SHALL 只保留代码与显式语言。归一后的标题 SHALL 不再以普通段落出现，代码文本与来源声明的语言 SHALL 保留。Rspress 识别 SHALL 收敛在独立适配单元中，由提取入口统一调用；主管线 SHALL NOT 按域名分支，其他站点结构 SHALL 不受影响。

#### Scenario: 带标题的代码块

- **WHEN** 来源页包含 Rspress 代码块标记，且代码块带有标题容器
- **THEN** 最终正文包含 `figure.code-block`，标题文本在 `figcaption` 中，代码在 `pre > code` 中，标题不再作为普通段落出现

#### Scenario: 无标题的代码块

- **WHEN** Rspress 代码块没有标题
- **THEN** 最终正文只保留 `pre > code`，不生成空标题或额外标题结构

#### Scenario: 语言保留

- **WHEN** Rspress 代码块声明了语言
- **THEN** 代码携带对应语言信息；受支持的语言按声明语言高亮，不退回自动检测

#### Scenario: 非 Rspress 页面

- **WHEN** 来源页没有 Rspress 代码块标记
- **THEN** 正文结构与改动前一致
