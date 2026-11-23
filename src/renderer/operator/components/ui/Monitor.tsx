import { Icon, type IconName } from './Icon'

export type Tally = 'program' | 'cue'

interface Props {
  label: string
  /** program = no telão (Mint); cue = próximo (Âmbar) */
  tally: Tally
  /** chip à direita do rótulo (ex.: "Tela preta") */
  status?: React.ReactNode
  /** muda quando o conteúdo troca: dispara a transição curta */
  contentKey?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/** Monitor 16:9 com luz de tally, como numa mesa de corte. */
export function Monitor({ label, tally, status, contentKey, children, footer }: Props): JSX.Element {
  return (
    <section className={`monitor monitor--${tally}`} aria-label={label}>
      <header className="monitor__head">
        <span className="monitor__lamp" aria-hidden="true" />
        <h2 className="monitor__label">{label}</h2>
        {status && <span className="monitor__status">{status}</span>}
      </header>
      <div className="monitor__screen">
        <div key={contentKey} className="monitor__content">
          {children}
        </div>
      </div>
      {footer}
    </section>
  )
}

/** Conteúdo de mídia num monitor: ícone + nome + tempo (nunca um segundo player). */
export function MediaCard({
  icon,
  title,
  detail,
  detailTone,
  thumb
}: {
  icon: IconName
  title: string
  detail?: string
  detailTone?: 'error'
  thumb?: string | null
}): JSX.Element {
  return (
    <div className="media-card">
      {thumb && <img className="media-card__thumb" src={thumb} alt="" draggable={false} />}
      <div className="media-card__body">
        <span className="media-card__icon">
          <Icon name={icon} size={22} />
        </span>
        <span className="media-card__title">{title}</span>
        {detail && (
          <span
            className={detailTone === 'error' ? 'media-card__detail media-card__detail--error' : 'media-card__detail'}
            role={detailTone === 'error' ? 'alert' : undefined}
          >
            {detail}
          </span>
        )}
      </div>
    </div>
  )
}

/** Mensagem centrada num monitor vazio. */
export function MonitorMessage({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="monitor__message">{children}</div>
}
