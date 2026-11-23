import { forwardRef } from 'react'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  icon?: IconName
  /** só ícone: o texto vira aria-label e title */
  iconOnly?: boolean
}

/** Botão do operador. Azul = agir; perigo = apagar/remover. */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'secondary', size = 'md', icon, iconOnly, className, children, type = 'button', title, 'aria-label': ariaLabel, ...rest },
  ref
) {
  const classes = ['btn', `btn--${variant}`, `btn--${size}`]
  if (iconOnly) classes.push('btn--icon')
  if (className) classes.push(className)
  const text = typeof children === 'string' ? children : undefined
  return (
    <button
      ref={ref}
      type={type}
      className={classes.join(' ')}
      aria-label={ariaLabel ?? (iconOnly ? text : undefined)}
      title={title ?? (iconOnly ? text : undefined)}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {!iconOnly && children !== undefined && <span className="btn__label">{children}</span>}
    </button>
  )
})
