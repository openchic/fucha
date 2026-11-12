import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import New from '@renderer/pages/New'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderNew(initialEntry = '/') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <New />
              <LocationProbe />
            </>
          }
        />
        <Route path="/preview" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
  return {
    input: screen.getByRole('textbox', { name: '文章链接' }) as HTMLInputElement,
    submit: screen.getByRole('button', { name: /生成预览/ }),
  }
}

describe('New 页面', () => {
  it('渲染输入框与提交按钮，并自动聚焦', () => {
    const { input } = renderNew()
    expect(input).toHaveFocus()
    expect(screen.getByPlaceholderText('粘贴文章链接')).toBeInTheDocument()
  })

  it('无协议链接自动补 https 并跳转预览', async () => {
    const { input, submit } = renderNew()
    await userEvent.type(input, 'example.com/post')
    await userEvent.click(submit)

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/preview?url=https%3A%2F%2Fexample.com%2Fpost'
      )
    )
  })

  it('接受本地 localhost 链接', async () => {
    const { input, submit } = renderNew()
    await userEvent.type(input, 'http://localhost:3000/post')
    await userEvent.click(submit)

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/preview?url=http%3A%2F%2Flocalhost%3A3000%2Fpost'
      )
    )
  })

  it.each([
    ['没有域名', 'abc'],
    ['非 http 协议', 'ftp://example.com/a'],
    ['带用户名', 'https://user@example.com/a'],
    ['带密码', 'https://user:pass@example.com/a'],
    ['含空白', 'https://example.com/a b'],
  ])('拒绝 %s 并提示', async (_, value) => {
    const { input, submit } = renderNew()
    await userEvent.type(input, value)
    await userEvent.click(submit)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '请输入有效的 HTTP 或 HTTPS 文章链接'
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveFocus()
  })

  it('输入后清除错误', async () => {
    const { input, submit } = renderNew()
    await userEvent.type(input, 'abc')
    await userEvent.click(submit)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await userEvent.type(input, '.com')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('清除按钮清空输入并聚焦', async () => {
    const { input } = renderNew()
    await userEvent.type(input, 'example.com')
    await userEvent.click(screen.getByRole('button', { name: '清除链接' }))

    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(screen.queryByRole('button', { name: '清除链接' })).not.toBeInTheDocument()
  })

  it('从查询参数预填链接', () => {
    const { input } = renderNew('/?url=https%3A%2F%2Fexample.com%2Fpost')
    expect(input).toHaveValue('https://example.com/post')
  })

  it('空输入提交给出错误且不跳转', async () => {
    const { submit } = renderNew()
    await userEvent.click(submit)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '请输入有效的 HTTP 或 HTTPS 文章链接'
    )
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })
})
