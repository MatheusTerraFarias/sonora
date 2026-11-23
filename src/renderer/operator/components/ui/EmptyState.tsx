import { Icon, type IconName } from './Icon'

interface EmptyProps {
  icon: IconName
  title: string
  text?: string
  action?: React.ReactNode
  compact?: boolean
}

/** Estado vazio que diz o que fazer. */
export function EmptyState({ icon, title, text, action, compact }: EmptyProps): JSX.Element {
  return (
    <div className={compact ? 'empty empty--compact' : 'empty'}>
      <span className="empty__icon">
        <Icon name={icon} size={compact ? 20 : 28} />
      </span>
      <p className="empty__title">{title}</p>
      {text && <p className="empty__text">{text}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

/** Mensagem de status curta (ok, aviso ou erro), sempre com texto. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn' | 'error'; children: React.ReactNode }): JSX.Element {
  const icon: IconName = tone === 'ok' ? 'check' : tone === 'info' ? 'alert' : tone === 'warn' ? 'wifiOff' : 'alert'
  return (
    <p className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {tone !== 'info' && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </p>
  )
}
