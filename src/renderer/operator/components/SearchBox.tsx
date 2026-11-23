import { strings } from '../../shared/strings'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
}

export function SearchBox({ value, onChange, placeholder, label = strings.common.search }: Props): JSX.Element {
  return (
    <input
      className="field"
      type="search"
      value={value}
      aria-label={label}
      placeholder={placeholder ?? label}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
