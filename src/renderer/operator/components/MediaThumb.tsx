import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import './MediaThumb.css'

const KIND_LABEL = { image: strings.media.kindImage, video: strings.media.kindVideo, audio: strings.media.kindAudio } as const

export const mediaUrl = (id: string): string => `sonora-media://${id}`

/** Imagem: o próprio arquivo. Vídeo: primeiro quadro (sem tocar). Áudio: ícone. */
export function MediaThumb({ media }: { media: MediaItem }): JSX.Element {
  return (
    <div className="media-thumb" title={`${KIND_LABEL[media.kind]}: ${media.originalName}`}>
      {media.kind === 'image' && <img src={mediaUrl(media.id)} alt={media.originalName} loading="lazy" />}
      {media.kind === 'video' && <video src={mediaUrl(media.id)} preload="metadata" muted playsInline />}
      {media.kind === 'audio' && (
        <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
          <path fill="currentColor" d="M9 3v11.3A3.5 3.5 0 1 0 11 17V7h6V3H9z" />
        </svg>
      )}
      {media.kind === 'video' && <span className="media-thumb__badge">{KIND_LABEL.video}</span>}
    </div>
  )
}
