import { strings } from '../../../shared/strings'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export const formatTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  playing: boolean
  volume: number
  position: number
  /** duração em segundos; desconhecida (undefined) até o telão informar o progresso */
  duration?: number
  /** só controla o que está no ar */
  disabled?: boolean
  onCommand: (cmd: { play?: boolean; volume?: number; position?: number }) => void
}

/** Transporte da mídia no ar: play/pausa, posição e volume. */
export function MediaControls({ playing, volume, position, duration, disabled, onCommand }: Props): JSX.Element {
  const known = !!duration && duration > 0
  return (
    <div className="transport" role="group" aria-label={strings.operation.mediaControlsTitle}>
      <Button
        variant="primary"
        icon={playing ? 'pause' : 'play'}
        iconOnly
        disabled={disabled}
        onClick={() => onCommand({ play: !playing })}
      >
        {playing ? strings.operation.pause : strings.operation.play}
      </Button>
      <div className="transport__position">
        <input
          className="range"
          type="range"
          aria-label={strings.operation.position}
          min={0}
          max={known ? duration : 1}
          step={0.1}
          value={known ? Math.min(position, duration) : 0}
          disabled={disabled || !known}
          onChange={(e) => onCommand({ position: Number(e.target.value) })}
        />
        <span className="transport__time tnum">
          {known ? `${formatTime(position)} / ${formatTime(duration)}` : strings.operation.unknownTime}
        </span>
      </div>
      <label className="transport__volume">
        <Icon name="volume" size={16} />
        <span className="visually-hidden">{strings.operation.volume}</span>
        <input
          className="range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={disabled}
          onChange={(e) => onCommand({ volume: Number(e.target.value) })}
        />
      </label>
    </div>
  )
}
