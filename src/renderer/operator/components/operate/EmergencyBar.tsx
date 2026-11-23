import type { Overlay } from '../../../../shared/types'
import { strings } from '../../../shared/strings'
import { Icon } from '../ui/Icon'
import { Keycap } from '../ui/Keycap'

interface Props {
  overlay: Overlay
  onOverlay: (o: Overlay) => void
}

const KEYS: { overlay: Overlay; label: string; key: string }[] = [
  { overlay: 'clear', label: strings.operation.clearText, key: 'C' },
  { overlay: 'black', label: strings.operation.black, key: 'B' },
  { overlay: 'logo', label: strings.operation.logo, key: 'L' },
  { overlay: 'none', label: strings.operation.background, key: 'Esc' }
]

/** Teclas de emergência (sempre visíveis), com a tecla do atalho desenhada no botão. */
export function EmergencyBar({ overlay, onOverlay }: Props): JSX.Element {
  return (
    <div className="emergency">
      <div className="emergency__keys" role="group" aria-label={strings.operation.emergencyLabel}>
        {KEYS.map((b) => {
          const on = b.overlay === overlay
          const cls = ['ekey']
          if (on) cls.push(b.overlay === 'none' ? 'ekey--normal' : 'ekey--on')
          return (
            <button key={b.overlay} type="button" className={cls.join(' ')} aria-pressed={on} onClick={() => onOverlay(b.overlay)}>
              <Keycap>{b.key}</Keycap>
              <span className="ekey__label">{b.label}</span>
            </button>
          )
        })}
      </div>
      <div className="emergency__nav" aria-label={strings.operation.navigationLabel}>
        <span className="emergency__nav-item">
          <Keycap label={strings.operation.prev}>
            <Icon name="arrowLeft" size={14} />
          </Keycap>
          {strings.operation.prev}
        </span>
        <span className="emergency__nav-item">
          <Keycap label={strings.operation.advance}>
            <Icon name="arrowRight" size={14} />
          </Keycap>
          <Keycap>{strings.operation.spaceKey}</Keycap>
          {strings.operation.advance}
        </span>
      </div>
    </div>
  )
}
