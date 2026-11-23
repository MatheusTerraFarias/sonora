import { useEffect, useState } from 'react'
import type { MediaItem, SongAttachment } from '../../../shared/types'
import { parseVideoId } from '../../../shared/youtube'
import { strings } from '../../shared/strings'
import { Notice } from './ui/EmptyState'
import { useSafe } from './useSafe'

type Mode = 'none' | 'youtube' | 'media'

interface Props {
  value: SongAttachment
  songTitle: string
  /** `valid` é falso quando o link do YouTube digitado não tem um vídeo */
  onChange: (value: SongAttachment, valid: boolean) => void
}

/** "Vídeo ou mídia da música": link do YouTube (validado) ou mídia da biblioteca. */
export function AttachmentField({ value, songTitle, onChange }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>(value?.kind ?? 'none')
  const [link, setLink] = useState(value?.kind === 'youtube' ? `https://youtu.be/${value.videoId}` : '')
  const [media, setMedia] = useState<MediaItem[]>([])
  const safe = useSafe()

  useEffect(() => {
    void safe.run(() => window.sonora.media.list()).then((r) => {
      if (r.ok) setMedia(r.value.filter((m) => m.kind !== 'image'))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const videoId = parseVideoId(link)
  const invalid = mode === 'youtube' && link.trim() !== '' && !videoId

  // o título da música acompanha o anexo do YouTube
  useEffect(() => {
    if (mode === 'youtube') onChange(videoId ? { kind: 'youtube', videoId, title: songTitle } : null, !invalid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songTitle, videoId])

  const changeMode = (m: Mode): void => {
    setMode(m)
    if (m === 'none') onChange(null, true)
    if (m === 'youtube') onChange(videoId ? { kind: 'youtube', videoId, title: songTitle } : null, !invalid)
    if (m === 'media') onChange(null, true)
  }

  return (
    <div className="field-row">
      <span className="field-row__label">{strings.songs.attachment}</span>
      <div className="attachment">
        <select className="input attachment__mode" aria-label={strings.songs.attachment} value={mode} onChange={(e) => changeMode(e.target.value as Mode)}>
          <option value="none">{strings.songs.attachmentNone}</option>
          <option value="youtube">{strings.songs.attachmentYoutube}</option>
          <option value="media">{strings.songs.attachmentMedia}</option>
        </select>
        {mode === 'youtube' && (
          <input
            className="input"
            value={link}
            aria-label={strings.songs.attachmentYoutube}
            placeholder={strings.songs.attachmentYoutubePlaceholder}
            onChange={(e) => setLink(e.target.value)}
          />
        )}
        {mode === 'media' && (
          <select
            className="input"
            aria-label={strings.songs.attachmentMedia}
            value={value?.kind === 'media' ? value.mediaId : ''}
            onChange={(e) => onChange(e.target.value ? { kind: 'media', mediaId: e.target.value } : null, true)}
          >
            <option value="">{strings.songs.attachmentPickMedia}</option>
            {media.map((m) => (
              <option key={m.id} value={m.id}>
                {m.originalName}
              </option>
            ))}
          </select>
        )}
      </div>
      {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
      {invalid && <span className="field-row__error">{strings.songs.attachmentInvalid}</span>}
    </div>
  )
}
