import { useEffect, useState } from 'react'
import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { mediaUrl } from './MediaThumb'
import './Operate.css'

export const formatTime = (sec: number): string => {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  playing: boolean
  volume: number
  position: number
  /** mídia local: a duração vem dos metadados do arquivo; YouTube: desconhecida */
  media?: MediaItem
  /** só controla o que está no ar */
  disabled?: boolean
  onCommand: (cmd: { play?: boolean; volume?: number; position?: number }) => void
}

/** Duração lida só dos metadados (sem tocar nem decodificar o vídeo). */
function useDuration(media?: MediaItem): number {
  const [duration, setDuration] = useState(0)
  useEffect(() => {
    setDuration(0)
    if (!media || media.kind === 'image') return
    const el = document.createElement(media.kind === 'video' ? 'video' : 'audio')
    el.preload = 'metadata'
    el.onloadedmetadata = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0)
    el.src = mediaUrl(media.id)
    return () => {
      el.onloadedmetadata = null
      el.removeAttribute('src')
      el.load()
    }
  }, [media])
  return duration
}

/** Play/pausa, volume e barra de posição. */
export function MediaControls({ playing, volume, position, media, disabled, onCommand }: Props): JSX.Element {
  const duration = useDuration(media)
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
          max={duration || 1}
          step={0.1}
          value={Math.min(position, duration || 1)}
          disabled={disabled || !duration}
          onChange={(e) => onCommand({ position: Number(e.target.value) })}
        />
        <span className="media-controls__time">
          {formatTime(position)}
          {duration ? ` / ${formatTime(duration)}` : ''}
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
