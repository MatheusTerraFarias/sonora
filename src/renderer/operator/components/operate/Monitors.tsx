import type { LiveProgress, LiveState, MediaItem, Slide } from '../../../../shared/types'
import { strings } from '../../../shared/strings'
import { mediaUrl } from '../MediaThumb'
import { MediaCard, Monitor, MonitorMessage } from '../ui/Monitor'
import { SlideCanvas } from '../ui/SlideCanvas'
import { formatTime } from './MediaControls'

export type NextPreview =
  | { kind: 'slide'; slide: Slide }
  | { kind: 'media'; media: MediaItem | null; title: string; thumbnail?: string | null }
  | { kind: 'end' }

const OVERLAY_LABEL = {
  clear: strings.operation.overlayClear,
  black: strings.operation.overlayBlack,
  logo: strings.operation.overlayLogo
} as const

const ytThumb = (videoId: string): string => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

/** Mídia num monitor: imagem aparece como no telão; vídeo e áudio viram ícone + nome + tempo. */
function MediaView({ media, detail }: { media: MediaItem; detail?: string }): JSX.Element {
  if (media.kind === 'image') return <img className="stage-image" src={mediaUrl(media.id)} alt="" draggable={false} />
  return <MediaCard icon={media.kind === 'video' ? 'film' : 'volume'} title={media.originalName} detail={detail} />
}

function Caption({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="monitor__caption">{children}</p>
}

/** Monitor "Próximo" (Âmbar). */
export function NextMonitor({ live, next, itemTitle }: { live: LiveState; next: NextPreview; itemTitle: string | null }): JSX.Element {
  let body: JSX.Element
  let caption: string | null = null
  let key = 'end'
  if (next.kind === 'slide') {
    body = <SlideCanvas slide={next.slide} background={live.background} style={live.style} />
    caption = [itemTitle, next.slide.label].filter(Boolean).join(' · ')
    key = `s:${next.slide.label}:${next.slide.text}`
  } else if (next.kind === 'media') {
    key = `m:${next.title}`
    body = (
      <SlideCanvas background={live.background} style={live.style} bare>
        {next.media ? (
          <MediaView media={next.media} />
        ) : (
          <MediaCard icon="youtube" title={next.title || strings.operation.youtubeItem} thumb={next.thumbnail} />
        )}
      </SlideCanvas>
    )
    caption = next.title
  } else {
    body = <MonitorMessage>{strings.operation.previewEnd}</MonitorMessage>
  }
  return (
    <Monitor label={strings.operation.next} tally="cue" contentKey={key} footer={<Caption>{caption ?? ' '}</Caption>}>
      {body}
    </Monitor>
  )
}

interface ProgramProps {
  live: LiveState
  progress: LiveProgress | null
  /** título do item no ar (para YouTube) */
  liveTitle: string | null
  children?: React.ReactNode
}

/** Monitor "No telão" (Mint): o que o público vê agora, incluindo as teclas de emergência. */
export function ProgramMonitor({ live, progress, liveTitle, children }: ProgramProps): JSX.Element {
  const c = live.content
  const time =
    progress && progress.duration > 0
      ? `${formatTime(progress.position)} / ${formatTime(progress.duration)}`
      : strings.operation.unknownTime
  const ytStatus = progress?.status ?? 'loading'
  let body: JSX.Element
  let caption: string | null = null
  let key = 'none'
  const canvas = (inner?: React.ReactNode, bare = false): JSX.Element => (
    <SlideCanvas
      bare={bare}
      slide={c.type === 'slide' ? c.slide : null}
      background={live.background}
      style={live.style}
      overlay={live.overlay}
      logoMediaId={live.logoMediaId}
    >
      {inner}
    </SlideCanvas>
  )
  if (c.type === 'slide') {
    body = canvas()
    caption = [liveTitle, c.slide.label].filter(Boolean).join(' · ')
    key = `s:${c.slide.label}:${c.slide.text}`
  } else if (c.type === 'media') {
    body = canvas(<MediaView media={c.media} detail={time} />, true)
    caption = c.media.originalName
    key = `m:${c.media.id}`
  } else if (c.type === 'youtube') {
    const detail = `${strings.operation.youtubeStatus[ytStatus]}${ytStatus === 'playing' || ytStatus === 'paused' ? ` · ${time}` : ''}`
    body = canvas(
      <MediaCard
        icon="youtube"
        title={liveTitle || strings.operation.youtubeItem}
        detail={detail}
        detailTone={ytStatus === 'error' ? 'error' : undefined}
        thumb={ytThumb(c.videoId)}
      />,
      true
    )
    caption = liveTitle || strings.operation.youtubeItem
    key = `y:${c.videoId}`
  } else if (live.overlay !== 'none') {
    body = canvas()
  } else {
    body = canvas(<span className="monitor__empty">{strings.operation.liveNothing}</span>)
  }
  return (
    <Monitor
      label={strings.operation.onScreen}
      tally="program"
      contentKey={`${key}:${live.overlay}`}
      status={
        live.overlay !== 'none' ? (
          <span className="chip-state chip-state--live">{OVERLAY_LABEL[live.overlay]}</span>
        ) : c.type !== 'none' ? (
          <span className="chip-state chip-state--live">{strings.operation.liveTag}</span>
        ) : null
      }
      footer={
        <>
          <Caption>{caption ?? ' '}</Caption>
          {children}
        </>
      }
    >
      {body}
    </Monitor>
  )
}
