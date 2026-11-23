import { Icon } from './Icon'

interface FieldProps {
  label: string
  hint?: string
  error?: string | null
  /** rótulo à esquerda do controle (configurações) */
  inline?: boolean
  className?: string
  children: React.ReactNode
}

/** Rótulo + controle + ajuda/erro. O controle vai dentro do <label> (getByLabel continua valendo). */
export function Field({ label, hint, error, inline, className, children }: FieldProps): JSX.Element {
  const classes = ['field-row']
  if (inline) classes.push('field-row--inline')
  if (className) classes.push(className)
  return (
    <div className={classes.join(' ')}>
      <label className="field-row__main">
        <span className="field-row__label">{label}</span>
        {children}
      </label>
      {error ? (
        <span className="field-row__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field-row__hint">{hint}</span>
      ) : null}
    </div>
  )
}

interface CheckProps {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Interruptor (checkbox estilizado). */
export function Toggle({ label, hint, checked, onChange }: CheckProps): JSX.Element {
  return (
    <div className="field-row">
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle__track" aria-hidden="true">
          <span className="toggle__thumb" />
        </span>
        <span className="toggle__label">{label}</span>
      </label>
      {hint && <span className="field-row__hint">{hint}</span>}
    </div>
  )
}

interface SearchProps {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  autoFocus?: boolean
}

/** Busca com ícone. */
export function SearchField({ value, onChange, label, placeholder, autoFocus }: SearchProps): JSX.Element {
  return (
    <div className="search">
      <Icon name="search" size={16} className="search__icon" />
      <input
        className="input search__input"
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder ?? label}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
