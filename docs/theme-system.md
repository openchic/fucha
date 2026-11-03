# 主题系统方案

主题系统分两层：token 是可调接口，theme.css 是主题自己的样式实现。内置主题只读；自定义主题可在设置页原地编辑，所有引用文章同步更新，也可以另存为或从默认 token 新建。主题配置页用内置示例文章实时预览，文章页只负责选择主题。

## 目标与非目标

**目标**

- A/B 主题各自拥有排版与装饰，但共用同一套 token 接口。
- 内置主题只读；自定义主题可原地编辑，编辑同步到所有引用文章；另存为与新建生成新主题。
- 用户可以在设置页调整字号、行高、间距、颜色、边框与圆角，示例预览实时生效。
- 自定义主题可以带自己的 CSS 和 token 默认值，按固定规则接入。
- 预览与导出共用同一套 token 和 theme.css，导出仍能落到微信可接受的内联样式。

**非目标**

- 不做应用内 CSS 编辑器。
- 不把每个元素的 margin/padding/border 都做进 token。
- 不改变文章内容的 HTML 结构；theme.css 只能作用于已有文章元素。
- 不引入外部字体、远程图片或 `@import`。

## 两层模型

```text
Theme A                          Theme B
  token 默认值 A                   token 默认值 B
  theme.css A                      theme.css B
        \                          /
         \                        /
          +---- 统一 token 接口 ---+
                     |
              用户简单调整 token
```

- token 是稳定的公共接口，约 20 个字段。
- theme.css 是主题实现，负责 token 表达不了的布局与逐元素盒模型。
- 文章只保存 `theme_id`；自定义主题原地编辑时，引用它的文章同步使用新内容；内置主题只读，升级时新增 id。

## 主题编辑与保存

自定义主题在设置页编辑；数据层保存当前内容，配置页用内存草稿和内置示例文章实时预览。

```text
data layer                         settings editor
theme A: token + css        <----   draft A' = A + 用户改动
article.theme_id = A                 示例预览使用 A'
                                     |
                             save -> 更新 theme A（所有引用文章）
                             save as -> 新建 theme B
                             new -> 新建 theme C（默认 token、无来源）
```

规则：

- 编辑 token 只改渲染进程内存草稿，不写数据库。
- 配置页用内置示例文章实时预览，不读取当前文章；文章页不再内联编辑主题。
- 保存自定义主题原地更新 `token`、`css` 与 `updated_at`：所有 `theme_id` 指向它的文章同步换样，不生成新主题。
- 另存为从当前草稿创建新主题并记录来源；新建从默认 token 起、来源为空。两者都不自动切换当前文章，回到文章后通过主题下拉选择。
- 内置主题只读，只能另存为；主题列表的内置行不提供编辑。
- 主题列表只展示已落库主题；草稿只存在于配置页，离开未保存时确认丢弃。
- 文章页的主题下拉只负责选择和打开主题管理；主题编辑、新建与删除都在设置页。
- v1 不生成主题版本；重复编辑更新同一主题。

## Token 契约

### 顶层结构

标题不再有 `heading` 包装，h1–h6 直接放在 Token 顶层。每个标题层级结构一致：

```ts
type HeadingLevel = {
  fontSize: number
  color?: string // 缺省回退 text.color
  textAlign: 'left' | 'center'
  decoration: 'none' | 'bar' | 'underline' | 'bracket'
  marginTop: number
  marginBottom: number
}
```

完整默认值：

```json
{
  "id": "default",
  "name": "清简",
  "builtin": true,
  "text": {
    "fontSize": 16,
    "secondaryFontSize": 14,
    "lineHeight": 1.75,
    "letterSpacing": 0.03,
    "marginBottom": 12,
    "color": "#333333",
    "secondaryColor": "#6b7280"
  },
  "primary": "#5e7b6f",
  "backgroundColor": "#f6f8fa",
  "borderColor": "#d0d7de",
  "borderRadius": 4,
  "h1": {
    "fontSize": 22,
    "textAlign": "left",
    "decoration": "bar",
    "marginTop": 24,
    "marginBottom": 12
  },
  "h2": {
    "fontSize": 20,
    "textAlign": "left",
    "decoration": "bar",
    "marginTop": 24,
    "marginBottom": 12
  },
  "h3": {
    "fontSize": 18,
    "textAlign": "left",
    "decoration": "bar",
    "marginTop": 24,
    "marginBottom": 12
  },
  "h4": {
    "fontSize": 16,
    "textAlign": "left",
    "decoration": "none",
    "marginTop": 20,
    "marginBottom": 8
  },
  "h5": {
    "fontSize": 14,
    "textAlign": "left",
    "decoration": "none",
    "marginTop": 20,
    "marginBottom": 8
  },
  "h6": {
    "fontSize": 14,
    "textAlign": "left",
    "decoration": "none",
    "marginTop": 20,
    "marginBottom": 8
  },
  "quote": {
    "padding": 12
  },
  "code": {
    "hljsTheme": "github",
    "lineHeight": 1.6,
    "padding": 16
  },
  "table": {
    "headerBackgroundColor": "#f6f8fa",
    "padding": 8
  },
  "image": {
    "marginTop": 16,
    "marginBottom": 16
  },
  "divider": {
    "borderTopStyle": "solid",
    "borderTopColor": "#d0d7de"
  }
}
```

### 字段与范围

| 字段                          | 默认                                 | 范围 / 值                        | 说明                                              |
| ----------------------------- | ------------------------------------ | -------------------------------- | ------------------------------------------------- |
| `text.fontSize`               | 16px                                 | 14–18                            | 正文、列表、引用、h4–h6 的回落字号                |
| `text.secondaryFontSize`      | 14px                                 | 12–16                            | 图注、上下标                                      |
| `text.lineHeight`             | 1.75                                 | 1.5–2.2                          | 正文、列表、引用行高                              |
| `text.letterSpacing`          | 0.03em                               | 0–0.1                            | 正文基础字距                                      |
| `text.marginBottom`           | 12px                                 | 4–20                             | 段落、列表、引用、代码块、表格、figure 的段后距   |
| `text.color`                  | #333333                              | 颜色                             | 正文主色，标题颜色缺省回退此值                    |
| `text.secondaryColor`         | #6b7280                              | 颜色                             | 弱化文字色，当前用于图注                          |
| `primary`                     | #5e7b6f                              | 颜色                             | 标题装饰与引用左边条                              |
| `backgroundColor`             | #f6f8fa                              | 颜色                             | 引用、行内代码底色；代码块见 code.backgroundColor |
| `borderColor`                 | #d0d7de                              | 颜色                             | 表格边框                                          |
| `borderRadius`                | 4px                                  | 0–12                             | 引用、代码、图片圆角                              |
| `h1–h3.fontSize`              | 22 / 20 / 18                         | 18–26 / 16–22 / 16–20            | 标题字号                                          |
| `h4–h6.fontSize`              | 16 / 14 / 14                         | 12–20                            | 标题字号                                          |
| 各级 `textAlign`              | left                                 | left / center                    | 标题对齐                                          |
| 各级 `decoration`             | bar / bar / bar / none / none / none | none / bar / underline / bracket | 标题装饰                                          |
| 各级 `marginTop`              | 24 / 24 / 24 / 20 / 20 / 20          | 12–36                            | 标题上外边距                                      |
| 各级 `marginBottom`           | 12 / 12 / 12 / 8 / 8 / 8             | 8–24                             | 标题下外边距                                      |
| `quote.padding`               | 12px                                 | 8–20                             | 引用块内边距                                      |
| `code.hljsTheme`              | github                               | github / atom-one-light / xcode  | highlight.js 语法色主题，未知值拒绝               |
| `code.lineHeight`             | 1.6                                  | 1.4–2.0                          | 代码块行高                                        |
| `code.padding`                | 16px                                 | 8–20                             | 代码块内边距                                      |
| `table.headerBackgroundColor` | #f6f8fa                              | 颜色                             | 表头底色；旧主题缺省回退 backgroundColor          |
| `table.padding`               | 8px                                  | 4–12                             | th / td 单元格内边距                              |
| `image.marginTop`             | 16px                                 | 8–24                             | 图片上外边距                                      |
| `image.marginBottom`          | 16px                                 | 8–24                             | 图片下外边距                                      |
| `divider.borderTopStyle`      | solid                                | solid / dotted / none            | 分割线样式                                        |
| `divider.borderTopColor`      | #d0d7de                              | 颜色                             | 分割线颜色；旧主题缺省回退 borderColor            |

标题颜色可选：`h1.color` 到 `h6.color` 未填时使用 `text.color`；填了只覆盖该层级。代码块、行内代码与表格不读 `secondaryFontSize`，字号按正文的 0.875 倍缩放，随 `text.fontSize` 变化。表头底色由 `table.headerBackgroundColor` 单独控制；旧主题缺少该字段时读取回退到 `backgroundColor`，视觉保持不变。

### 标题装饰

| 值          | 生成样式                                                  |
| ----------- | --------------------------------------------------------- |
| `none`      | 无边框与额外内边距                                        |
| `bar`       | `border-left: 3px solid primary`，`padding-left: 12px`    |
| `underline` | `border-bottom: 2px solid primary`，`padding-bottom: 6px` |
| `bracket`   | 左右各 `2px solid primary`，`padding: 0 10px`             |

装饰只用真实边框，不用伪元素；微信会剥离伪元素。

### CSS 变量契约

主题 CSS 只能引用以下类型变量：

```text
--fucha-primary
--fucha-background-color
--fucha-table-header-background-color
--fucha-border-color
--fucha-border-radius
--fucha-text-font-size
--fucha-text-secondary-font-size
--fucha-text-line-height
--fucha-text-letter-spacing
--fucha-text-margin-bottom
--fucha-text-color
--fucha-text-secondary-color
--fucha-h1-font-size ... --fucha-h6-font-size
--fucha-h1-color ... --fucha-h6-color
--fucha-h1-text-align ... --fucha-h6-text-align
--fucha-h1-margin-top ... --fucha-h6-margin-bottom
--fucha-quote-padding
--fucha-code-line-height
--fucha-code-padding
--fucha-code-background-color
--fucha-table-padding
--fucha-image-margin-top
--fucha-image-margin-bottom
--fucha-divider-border-top-style
--fucha-divider-border-top-color
```

`hljsTheme` 不是 CSS 变量，由导出/预览直接选择语法主题，可选 `github`、`atom-one-light`、`xcode`。历史主题里的未知值读取时归一到 `github`，新建、编辑与导入时拒绝未知值。语法主题决定语法色与缺省代码块背景；`code.backgroundColor` 可选，设置后覆盖代码块背景。`backgroundColor` 用于引用与行内代码，表头底色由 `table.headerBackgroundColor` 提供；自定义 `theme.css` 可以继续覆盖 `pre` 与 `th` 背景及 `.hljs` 颜色。

## 样式归属与元素盒模型

应用维护一份 `base.css`，覆盖正文默认排版、引用、代码、表格、图片、分割线与微信安全属性；除代码与表格按正文 0.875 倍取字号外，样式只引用 token 变量。

主题的 `theme.css` 只写差异。加载顺序固定为 `base.css` → 装饰规则 → hljs 语法色 → `theme.css`，同选择器后写覆盖，主题永远有最终决定权。

逐元素 margin/padding/border 不进入 token，写在 theme.css：

| 范围                | 元素                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| 完整盒模型          | `p`、`h1`–`h6`、`ul`、`ol`、`li`、`blockquote`、`pre`、`table`、`figure`、`figcaption`、`img`、`hr` |
| 仅 padding + border | `th`、`td`（table-cell 的 margin 不生效）                                                           |
| 不开放盒模型        | `a`、`strong`、`em`、`b`、`i`、`u`、`s`、行内 `code`、`sup`、`sub`、`svg`                           |

`img` 左右外边距固定为 `auto`，theme.css 控制上下外边距。

## Theme CSS 契约

`theme.css` 只能使用元素、类与后代选择器：

```css
h2 { ... }
pre code { ... }
.hljs-keyword { ... }
```

禁止：

- 伪类与伪元素：`:hover`、`::before`、`:first-child`
- `@` 规则：`@media`、`@import`、`@font-face`、`@keyframes`、`@layer`
- `!important`
- 外部资源：`url(http...)`、远程字体与图片
- token 契约之外的 `var(--fucha-*)`
- 微信不支持的属性：`position`、`float`、`grid`、`flex` 布局等

导入时做 fail-closed 静态校验：任何一条不通过就拒绝整个主题包，并给出行号与原因，不做部分导入。

## 主题包与导入导出

主题包使用 zip：

```text
my-theme.fucha-theme
  theme.json
  theme.css
```

`theme.json`：

```json
{
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "tokenVersion": 1,
  "token": { "...": "完整 token 默认值" }
}
```

- 内置主题与自定义主题共用同一结构；当前内置「清简」（id `default`）与「书卷」（id `serif`），只读，升级时新增主题 id，旧 id 保留，避免历史文章换样。
- 自定义主题导入后，token 与 CSS 存入本地 SQLite；同一 id 或内置 id 已存在时拒绝导入。导入后的自定义主题可原地编辑，也可另存为或新建。
- 导出主题时把当前 token 和 CSS 重新打包成同样的 zip；内置主题导出时 token 的 `builtin` 置为 false，导入后成为普通自定义主题。不导出文章内容。
- 自定义主题只允许 CSS 与 token，不允许注入 HTML 或脚本。

## 预览与导出

```text
preview:
  token -> .article-body CSS 变量
  base.css + theme.css -> 注入预览

export:
  token -> 具体值变量表
  base.css + theme.css -> 解析 var()
  -> juice 内联
  -> 微信属性过滤
```

- 预览不解析 `var()`，直接用浏览器变量。
- 导出必须把所有 `var(--fucha-*)` 替换成具体值，再交给 juice；juice 不解析 CSS 变量。
- 预览和复制使用当前文章选中的已落库主题；配置页的示例预览使用编辑草稿，保存后回到文章自然加载。
- 导出前仍执行正文归一：去重复首标题、清引用末段距、外链降级。
- 预览注入时统一加 `.article-body` 作用域；导出由 juice 直接作用于正文子树。

## 存储

文章只保存 `theme_id`。`themes` 表保存：

| 字段              | 用途                                              |
| ----------------- | ------------------------------------------------- |
| `id`              | 主题 id，全局唯一；不能与内置主题 id 冲突         |
| `name`            | 显示名，可改名                                    |
| `token`           | 该主题的 token                                    |
| `css`             | theme.css 全文                                    |
| `token_version`   | token 接口版本，当前为 1                          |
| `source_theme_id` | 来源主题 id，可空；只作血缘记录，不参与渲染与导出 |
| `sort`            | 自定义主题排序                                    |
| `created_at`      | 主题创建时间                                      |
| `updated_at`      | 最近修改时间；编辑内容、改名与排序会更新此字段    |

`source_theme_id` 在从主题包直接导入、来源主题已被删除或新建时未指定来源时为空；来源可以是内置主题 id，因此不做外键，删除来源主题时由应用把引用置空。它只回答「这个主题从哪个主题调整而来」，预览、复制与导出都不读取该字段。

内置主题不写入 `themes`，继续由代码提供且只读。自定义主题的 token 与 CSS 进库，通过 `updateTheme` 原地更新；另存为与新建通过 `createTheme` 生成新行。删除主题前检查 `articles.theme_id` 引用：有引用时拒绝删除或要求先迁移文章，不静默回退。

## 设置页与主题管理

- 主题管理在独立的 `/settings` 布局：左侧设置导航（当前只有主题管理），右侧是主题列表与配置页；文章页的主题下拉只负责选择与打开主题管理。
- 列表页分内置与自定义：内置只读，只能另存为；自定义可编辑（含改名）、另存为、导出与删除；顶部提供新建与导入。
- 主题名称全局唯一（含内置主题，不区分英文大小写）；新建、另存为、导入或改名遇到重名时拒绝，并保留表单内容。
- 配置页左侧是固定示例文章预览，右侧是 token 控件；示例文章覆盖标题、正文、列表、引用、行内代码、代码块、表格、图片、图注、上下标与分割线，改动实时反映。
- 控件偏离打开编辑器时的保存值时提供恢复入口：有右对齐值的字段在值左侧显示重置图标，分段与复选框放在标签行右侧；代码块背景保留「重置」清空为跟随语法主题，保存值本身带背景色时额外显示恢复图标。恢复只影响该字段。
- 颜色行不常驻显示色值；点击色块打开取色弹层，使用 `@uiw/react-color` 的 Sketch，含饱和度/色相、3/6 位 Hex 与 RGB 输入；关闭 alpha，只产生不透明 hex。
- 正文色与白底、块底色、表头底色，以及弱化文字与白底的对比度低于 4.5:1 时，在该行说明位显示最低的一对与具体比值，不增加行高、不阻止保存；装饰色与代码语法色不参与校验。
- 颜色与数值控件的说明通过 `aria-describedby` 关联到输入，读屏会同时读出用途说明和对比度提示。
- 配置页不读取当前文章，也不做跨页同步；保存后返回文章时 Preview 重新挂载并加载已落库主题。
- 自定义主题编辑保存原地更新，所有引用文章同步换样；另存为/新建生成新主题但不自动切换当前文章，应用仍走文章页主题下拉。
- 内置主题不提供编辑入口；从内置另存为时配置页只提供「另存为新主题」。
- 未保存离开配置页或设置页时提示丢弃。
- 面板不提供逐元素 margin/padding/border 编辑，也不提供 CSS 编辑器。
- 自定义主题通过导入/导出主题包完成；导入只创建新主题，不覆盖已有 id 或内置 id。

## 风险与待确认

- 原地编辑当前主题会同步所有引用文章，历史文章样式会随主题更新；这是明确选择的行为，编辑前需确认理解。
- 内置主题升级必须新增 id，旧 id 保留；否则历史文章会换样。
- 删除被文章引用的主题必须拒绝或先迁移文章，不做静默回退。
- 主题 CSS 的静态校验成本较高；v1 先限定最小选择器与属性集合，后续按需求扩展。
- 自定义主题 CSS 可能破坏微信兼容性；导入时 fail-closed，运行时不静默修正。
- `tokenVersion` 用于接口升级；旧主题包需要兼容迁移或拒绝导入。
- 主题是否允许新增 HTML 包装结构：当前方案不允许，只允许 CSS；如果以后要支持布局模板，需要单独设计 HTML 模板契约。
