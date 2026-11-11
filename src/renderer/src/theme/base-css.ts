/** 正文基础排版；只引用 token 变量，主题 CSS 在此基础上写差异 */
export const BASE_CSS = `
p {
  margin: 0 0 var(--theme-text-margin-bottom);
  color: var(--theme-text-color);
  font-size: var(--theme-text-font-size);
  line-height: var(--theme-text-line-height);
  letter-spacing: var(--theme-text-letter-spacing);
  word-break: break-word;
}

h1 {
  margin-top: var(--theme-h1-margin-top);
  margin-bottom: var(--theme-h1-margin-bottom);
  color: var(--theme-h1-color);
  font-size: var(--theme-h1-font-size);
  font-weight: var(--theme-h1-font-weight);
  line-height: var(--theme-h1-line-height);
  text-align: var(--theme-h1-text-align);
}

h2 {
  margin-top: var(--theme-h2-margin-top);
  margin-bottom: var(--theme-h2-margin-bottom);
  color: var(--theme-h2-color);
  font-size: var(--theme-h2-font-size);
  font-weight: var(--theme-h2-font-weight);
  line-height: var(--theme-h2-line-height);
  text-align: var(--theme-h2-text-align);
}

h3 {
  margin-top: var(--theme-h3-margin-top);
  margin-bottom: var(--theme-h3-margin-bottom);
  color: var(--theme-h3-color);
  font-size: var(--theme-h3-font-size);
  font-weight: var(--theme-h3-font-weight);
  line-height: var(--theme-h3-line-height);
  text-align: var(--theme-h3-text-align);
}

h4 {
  margin-top: var(--theme-h4-margin-top);
  margin-bottom: var(--theme-h4-margin-bottom);
  color: var(--theme-h4-color);
  font-size: var(--theme-h4-font-size);
  font-weight: var(--theme-h4-font-weight);
  line-height: var(--theme-h4-line-height);
  text-align: var(--theme-h4-text-align);
}

h5 {
  margin-top: var(--theme-h5-margin-top);
  margin-bottom: var(--theme-h5-margin-bottom);
  color: var(--theme-h5-color);
  font-size: var(--theme-h5-font-size);
  font-weight: var(--theme-h5-font-weight);
  line-height: var(--theme-h5-line-height);
  text-align: var(--theme-h5-text-align);
}

h6 {
  margin-top: var(--theme-h6-margin-top);
  margin-bottom: var(--theme-h6-margin-bottom);
  color: var(--theme-h6-color);
  font-size: var(--theme-h6-font-size);
  font-weight: var(--theme-h6-font-weight);
  line-height: var(--theme-h6-line-height);
  text-align: var(--theme-h6-text-align);
}

strong,
b {
  color: var(--theme-text-color);
  font-weight: 700;
}

h1 strong,
h1 b,
h2 strong,
h2 b,
h3 strong,
h3 b,
h4 strong,
h4 b,
h5 strong,
h5 b,
h6 strong,
h6 b {
  color: inherit;
  font-weight: inherit;
}

em,
i {
  color: var(--theme-text-color);
  font-style: italic;
}

a {
  color: var(--theme-text-color);
  text-decoration: underline;
}

ul {
  margin: 0 0 var(--theme-text-margin-bottom);
  padding-left: 24px;
  color: var(--theme-text-color);
  font-size: var(--theme-text-font-size);
  line-height: var(--theme-text-line-height);
  list-style-type: disc;
}

ol {
  margin: 0 0 var(--theme-text-margin-bottom);
  padding-left: 24px;
  color: var(--theme-text-color);
  font-size: var(--theme-text-font-size);
  line-height: var(--theme-text-line-height);
  list-style-type: decimal;
}

li {
  margin: 0 0 var(--theme-text-list-gap);
  color: var(--theme-text-color);
  font-size: var(--theme-text-font-size);
  line-height: var(--theme-text-line-height);
}

blockquote {
  margin: 0 0 var(--theme-text-margin-bottom);
  padding: var(--theme-quote-padding-block) var(--theme-quote-padding-inline);
  color: var(--theme-text-color);
  font-size: var(--theme-quote-font-size);
  line-height: var(--theme-text-line-height);
  background-color: var(--theme-quote-background-color);
  border-left: 3px var(--theme-quote-border-left-style) var(--theme-primary);
  border-radius: var(--theme-quote-border-radius);
}

blockquote p,
blockquote ul,
blockquote ol,
blockquote li {
  font-size: inherit;
  line-height: inherit;
}

blockquote > :last-child {
  margin-bottom: 0;
}

pre {
  margin: 0 0 var(--theme-text-margin-bottom);
  padding: var(--theme-code-padding-block) var(--theme-code-padding-inline);
  color: var(--theme-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--theme-code-font-size);
  line-height: var(--theme-code-line-height);
  background-color: var(--theme-code-background-color);
  border: 1px var(--theme-code-border-style) var(--theme-border-color);
  border-radius: var(--theme-code-border-radius);
  overflow-x: auto;
  white-space: pre;
  word-break: normal;
}

pre code {
  padding: 0;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: inherit;
  line-height: inherit;
  background-color: transparent;
  border-radius: 0;
  white-space: inherit;
  word-break: normal;
}

figure.code-block {
  background-color: var(--theme-code-background-color);
  border: 1px var(--theme-code-border-style) var(--theme-border-color);
  border-radius: var(--theme-code-border-radius);
}

.code-block figcaption {
  margin: 0;
  padding: var(--theme-code-padding-block) var(--theme-code-padding-inline);
  color: var(--theme-text-secondary-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--theme-text-secondary-font-size);
  line-height: 1.6;
  text-align: left;
  border-bottom: 1px var(--theme-code-caption-border-bottom-style)
    var(--theme-code-caption-border-bottom-color);
}

figure.code-block pre {
  margin: 0;
  border: none;
  border-radius: 0 0 var(--theme-code-border-radius) var(--theme-code-border-radius);
}

code {
  padding: 2px 4px;
  color: var(--theme-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875em;
  background-color: var(--theme-code-inline-background-color);
  border-radius: var(--theme-code-inline-border-radius);
}

table {
  width: 100%;
  margin: 0 0 var(--theme-text-margin-bottom);
  color: var(--theme-text-color);
  font-size: 0.875em;
  line-height: 1.6;
  border-collapse: collapse;
}

figure.table-scroll {
  margin: 0 0 var(--theme-text-margin-bottom);
  border: 1px solid var(--theme-border-color);
  border-radius: var(--theme-code-border-radius);
  overflow-x: auto;
}

figure.table-scroll table {
  margin: 0;
  width: 100%;
}

/* 三列及以上按内容自然宽度排布：放得下就铺满，放不下在框内滚动 */
figure.table-scroll-wide table {
  width: max-content;
  min-width: 100%;
}

figure.table-scroll-wide th,
figure.table-scroll-wide td {
  min-width: 5em;
  max-width: 18em;
}

figure.table-scroll thead > tr:first-child > *,
figure.table-scroll tbody:first-child > tr:first-child > * {
  border-top: none;
}

figure.table-scroll tbody:last-child > tr:last-child > * {
  border-bottom: none;
}

figure.table-scroll tr > :first-child {
  border-left: none;
}

figure.table-scroll tr > :last-child {
  border-right: none;
}

th {
  padding: var(--theme-table-padding-block) var(--theme-table-padding-inline);
  color: var(--theme-text-color);
  font-weight: 600;
  line-height: 1.6;
  text-align: left;
  vertical-align: top;
  background-color: var(--theme-table-header-background-color);
  border: 1px solid var(--theme-border-color);
}

td {
  padding: var(--theme-table-padding-block) var(--theme-table-padding-inline);
  color: var(--theme-text-color);
  line-height: 1.6;
  text-align: left;
  vertical-align: top;
  border: 1px solid var(--theme-border-color);
}

img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: var(--theme-image-margin-top) auto var(--theme-image-margin-bottom);
  border-radius: var(--theme-image-border-radius);
}

figure {
  margin: 0 0 var(--theme-text-margin-bottom);
}

figcaption {
  margin: 4px 0 var(--theme-image-margin-bottom);
  color: var(--theme-text-secondary-color);
  font-size: var(--theme-text-secondary-font-size);
  line-height: 1.6;
  text-align: center;
}

figure > img:has(+ figcaption),
figure > a:has(+ figcaption) > img:last-child {
  margin-bottom: 0;
}

figure > img + figcaption,
figure > a:has(> img:last-child) + figcaption {
  margin-top: 8px;
}

hr {
  height: 0;
  margin: var(--theme-divider-margin-top) 0 var(--theme-divider-margin-bottom);
  border: none;
  border-top: 1px var(--theme-divider-border-top-style) var(--theme-divider-border-top-color);
}

sup {
  font-size: var(--theme-text-secondary-font-size);
  vertical-align: super;
}

sub {
  font-size: var(--theme-text-secondary-font-size);
  vertical-align: sub;
}

svg {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}
`
