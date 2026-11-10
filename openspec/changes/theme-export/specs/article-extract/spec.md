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

### Requirement: 正文快照的结构边界

提取 SHALL 在抓取时把语义结构冻结进 `Article.html`。提取阶段的规则——Readability 正文判定、站点 profile、标签与属性白名单、SVG 内联、Rspress 代码块归一——变更后 SHALL 只影响之后抓取的文章，系统 SHALL NOT 自动迁移或重写旧快照。旧文章需要新结构时 SHALL 通过重新抓取或显式刷新快照完成。渲染与导出阶段的规则——正文归一、语法高亮、微信结构投影与样式内联——SHALL 在读取快照时执行，对所有文章生效，且 SHALL NOT 改写快照。主题 token 与 theme.css 变更同样 SHALL 对所有文章生效。规则属于哪一层的判断标准是它是否写入 `Article.html`。

#### Scenario: 提取规则变更

- **WHEN** 修改标签白名单、站点 profile 或 Rspress 代码块归一规则
- **THEN** 新抓取的文章使用新结构；旧快照保持原样，不执行自动迁移

#### Scenario: 渲染或导出修复

- **WHEN** 修改引用转 section、列表包 p、代码逐行拆块或微信属性过滤
- **THEN** 旧快照在预览与导出时同样应用新投影，快照本身不被改写

#### Scenario: 主题变更

- **WHEN** 切换主题或修改 token 与 theme.css
- **THEN** 所有文章按新主题渲染，无需重新提取

#### Scenario: 旧文章升级

- **WHEN** 需要让旧文章获得新的提取结构
- **THEN** 由重新抓取或显式刷新快照触发，而不是数据库迁移
