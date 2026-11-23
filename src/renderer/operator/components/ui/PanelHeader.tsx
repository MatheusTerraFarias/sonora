interface HeaderProps {
  title: string
  /** linha secundária (contagem, data, tipo) */
  meta?: React.ReactNode
  /** h1 para o título da tela, h2 para painéis */
  level?: 1 | 2
  actions?: React.ReactNode
  className?: string
}

/** Cabeçalho de painel: título à esquerda, ações agrupadas à direita. */
export function PanelHeader({ title, meta, level = 2, actions, className }: HeaderProps): JSX.Element {
  const H = level === 1 ? 'h1' : 'h2'
  return (
    <header className={className ? `panel-header ${className}` : 'panel-header'}>
      <div className="panel-header__text">
        <H className={level === 1 ? 'panel-header__title panel-header__title--lg' : 'panel-header__title'}>{title}</H>
        {meta !== undefined && meta !== null && meta !== '' && <p className="panel-header__meta">{meta}</p>}
      </div>
      {actions && <div className="panel-header__actions">{actions}</div>}
    </header>
  )
}
