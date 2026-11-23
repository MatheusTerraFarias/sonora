import type { LiveState, MediaItem, Slide } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { formatTime } from './MediaControls'
import { MediaThumb } from './MediaThumb'
import { SlideThumb } from './SlideThumb'
import './Operate.css'

export type NextPreview =
  | { kind: 'slide'; slide: Slide }
  | { kind: 'media'; media: MediaItem | null; title: string }
  | { kind: 'end' }

interface Props {
  live: LiveState
  next: NextPreview
}

const OVERLAY_LABEL = {
  clear: strings.operation.overlayClear,
  black: strings.operation.overlayBlack,
  logo: strings.operation.overlayLogo
} as const

/** Prévia (próximo slide) e Ao vivo (estado atual): miniaturas leves, nunca uma segunda cópia do vídeo. */
export function PreviewPanel({ live, next }: Props): JSX.Element {
  const c = live.content
  return (
    <aside className="preview-panel">
      <section>
        <h2 className="pane-title">{strings.operation.preview}</h2>
        <div className="preview-box">
          {next.kind === 'slide' && <SlideThumb label={strings.operation.previewNext} text={next.slide.text} />}
          {next.kind === 'media' && (
            <>
              {next.media && <MediaThumb media={next.media} />}
              <span className="preview-box__title">{next.title}</span>
            </>
          )}
          {next.kind === 'end' && <p className="hint">{strings.operation.previewEnd}</p>}
        </div>
      </section>
      <section>
        <h2 className="pane-title">{strings.operation.live}</h2>
        <div className="preview-box preview-box--live">
          {live.overlay !== 'none' && <span className="preview-box__badge">{OVERLAY_LABEL[live.overlay]}</span>}
          {c.type === 'slide' && <SlideThumb label={c.slide.label} text={c.slide.text} />}
          {c.type === 'media' && (
            <>
              <MediaThumb media={c.media} />
              <span className="preview-box__title">{formatTime(c.position)}</span>
            </>
          )}
          {c.type === 'youtube' && (
            <>
              <div className="preview-box__yt">{strings.operation.youtubeItem}</div>
              <span className="preview-box__title">{formatTime(c.position)}</span>
            </>
          )}
          {c.type === 'none' && live.overlay === 'none' && <p className="hint">{strings.operation.liveNothing}</p>}
        </div>
      </section>
    </aside>
  )
}
