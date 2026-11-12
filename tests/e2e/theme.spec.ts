import { expectPassing, test } from './fixtures'

test('主题 token、预设与 CSS 生成规则', async ({ checks }) => {
  expectPassing(await checks.run(['theme']))
})
