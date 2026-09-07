import type { ThemeDefinition, ThemeToken } from '@shared/types'

/** 根节点用系统衬线字族，引用边条收细，图注收紧字距 */
const css = `
& {
  font-family: 'Songti SC', 'Noto Serif CJK SC', 'Source Han Serif SC', 'SimSun', serif;
}

blockquote {
  border-left-width: 2px;
}

figcaption {
  letter-spacing: 0.04em;
}
`

const token = {
  id: 'shujuan',
  name: '书卷',
  builtin: true,
  text: {
    fontSize: 14,
    secondaryFontSize: 12,
    lineHeight: 1.85,
    letterSpacing: 0.02,
    marginBottom: 16,
    color: '#221e1b',
    secondaryColor: '#5f564e',
  },
  primary: '#ad6849',
  borderColor: '#ece5db',
  headingColor: '#1e1a18',
  page: {
    paddingTop: 32,
    paddingRight: 0,
    paddingBottom: 40,
    paddingLeft: 0,
  },
  h1: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'left',
    decoration: 'none',
    marginTop: 28,
    marginBottom: 14,
  },
  h2: {
    fontSize: 20,
    fontWeight: 600,
    lineHeight: 1.4,
    textAlign: 'left',
    decoration: 'none',
    marginTop: 28,
    marginBottom: 14,
  },
  h3: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.5,
    textAlign: 'left',
    decoration: 'none',
    marginTop: 20,
    marginBottom: 8,
  },
  h4: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.5,
    textAlign: 'left',
    decoration: 'none',
    marginTop: 20,
    marginBottom: 8,
  },
  h5: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.5,
    textAlign: 'left',
    decoration: 'none',
    marginTop: 20,
    marginBottom: 8,
  },
  h6: {
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.5,
    textAlign: 'left',
    decoration: 'none',
    marginTop: 20,
    marginBottom: 8,
  },
  quote: {
    backgroundColor: '#faf7f2',
    fontSize: 14,
    decoration: 'bar',
    paddingBlock: 16,
    paddingInline: 16,
    borderRadius: 0,
  },
  code: {
    hljsTheme: 'github',
    backgroundColor: '#faf7f2',
    fontSize: 13,
    inlineBackgroundColor: '#faf7f2',
    lineHeight: 1.7,
    paddingBlock: 18,
    paddingInline: 18,
    borderRadius: 0,
    inlineBorderRadius: 0,
    borderStyle: 'none',
    captionDivider: {
      borderBottomStyle: 'solid',
      borderBottomColor: '#f1ece4',
    },
  },
  table: {
    headerBackgroundColor: '#faf7f2',
    paddingBlock: 10,
    paddingInline: 10,
  },
  image: {
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 0,
  },
  divider: {
    borderTopStyle: 'solid',
    borderTopColor: '#e3d9cc',
    marginTop: 20,
    marginBottom: 20,
  },
} satisfies ThemeToken

export const shujuanPreset: ThemeDefinition = { token, css }
