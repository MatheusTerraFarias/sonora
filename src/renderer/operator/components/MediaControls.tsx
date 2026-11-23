import { strings } from '../../shared/strings'
import './Operate.css'

export const formatTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  playing: boolean
  volume: number
  position: number
  /** duração em segundos; desconhecida (undefined) até o telão informar o progresso (Task 13) */
  duration?: number
  /** só controla o que está no ar */
  disabled?: boolean
  onCommand: (cmd: { play?: boolean; volume?: number; position?: number }) => void
}

/** Play/pausa, volume e barra de posição. */
export function MediaControls({ playing, volume, position, duration, disabled, onCommand }: Props): JSX.Element {
  const known = !!duration && duration > 0
  return (
    <div className="media-controls" role="group" aria-label={strings.operation.mediaControlsTitle}>
      <button type="button" className="btn btn--primary" disabled={disabled} onClick={() => onCommand({ play: !playing })}>
        {playing ? strings.operation.pause : strings.operation.play}
      </button>
      <label className="media-controls__slider">
        <span>{strings.operation.position}</span>
        <input
          type="range"
          min={0}
          max={known ? duration : 1}
          step={0.1}
          value={known ? Math.min(position, duration) : 0}
          disabled={disabled || !known}
          onChange={(e) => onCommand({ position: Number(e.target.value) })}
        />
        <span className="media-controls__time">
          {known ? `${formatTime(position)} / ${formatTime(duration)}` : strings.operation.unknownTime}
        </span>
      </label>
      <label className="media-controls__slider">
        <span>{strings.operation.volume}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={disabled}
          onChange={(e) => onCommand({ volume: Number(e.target.value) })}
        />
      </label>
      {disabled && <p className="hint">{strings.operation.controlsOnlyLive}</p>}
    </div>
  )
}
