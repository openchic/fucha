import type { ComponentPropsWithRef } from 'react'
import './index.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'back'

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: ButtonVariant
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'button-primary',
  secondary: 'button-secondary',
  danger: 'button-danger',
  back: 'button-back',
}

/** 应用壳胶囊按钮：统一基础样式、变体与默认 button 类型 */
export const Button = (props: ButtonProps) => {
  const { variant = 'secondary', type = 'button', className, ...rest } = props
  return (
    <button
      type={type}
      className={['button', VARIANT_CLASS[variant], className].filter(Boolean).join(' ')}
      {...rest}
    />
  )
}

Button.displayName = 'Button'
