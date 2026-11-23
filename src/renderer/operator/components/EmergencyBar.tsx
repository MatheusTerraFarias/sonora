import type { Overlay } from '../../../shared/types'
import { strings } from '../../shared/strings'
import './Operate.css'

interface Props {
  overlay: Overlay
  /** rótulo do monitor do telão; null quando desconectado */
  monitorLabel: string | null
  onOverlay: (o: Overlay) => void
}

const BUTTONS: { overlay: Overlay; label: string }[] = [
  { overlay: 'clear', label: strings.operation.clearText },
  { overlay: 'black', label: strings.operation.black },
  { overlay: 'logo', label: strings.operation.logo },
  { overlay: 'none', label: strings.operation.background }
]

/** Barra inferior: botões de emergência sempre visíveis + monitor do telão. */
export function EmergencyBar({ overlay, monitorLabel, onOverlay }: Props): JSX.Element {
  return (
    <div className="emergency">
      <div className="emergency__buttons">
        {BUTTONS.map((b) => (
          <button
            key={b.overlay}
            type="button"
            className={b.overlay === overlay ? 'btn emergency__btn emergency__btn--on' : 'btn emergency__btn'}
            aria-pressed={b.overlay === overlay}
            onClick={() => onOverlay(b.overlay)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <span className="hint emergency__keys">{strings.operation.shortcuts}</span>
      <span className={monitorLabel ? 'emergency__monitor' : 'emergency__monitor emergency__monitor--off'} role="status">
        {monitorLabel ? `${strings.operation.monitor}: ${monitorLabel}` : strings.operation.disconnected}
      </span>
    </div>
  )
}
