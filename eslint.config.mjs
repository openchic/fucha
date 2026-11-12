import config from '@vainjs/eslint-config/react'

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  { ignores: ['out/**', 'dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**'] },
  {
    rules: {
      // React 19 用自动运行时（tsconfig 里 jsx: react-jsx），JSX 不需要 React 在作用域内
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    // Playwright fixture 的 use 回调不是 React Hook，且其导出的类型解析不兼容 import/named
    files: ['tests/e2e/**/*.ts', 'playwright.config.ts'],
    rules: {
      'import/named': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'no-empty-pattern': 'off',
    },
  },
]
