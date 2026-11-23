import type { ID, MediaItem, ResolvedItem, ServiceItemData, SongAttachment } from '../../../../shared/types'
import { strings } from '../../../shared/strings'
import { Button } from '../ui/Button'
import { Icon, type IconName } from '../ui/Icon'

export function kindIcon(data: ServiceItemData, library: MediaItem[] = []): IconName {
  switch (data.kind) {
    case 'song':
      return 'music'
    case 'bible':
      return 'book'
    case 'media': {
      const m = library.find((x) => x.id === data.mediaId)
      return m?.kind === 'video' ? 'film' : m?.kind === 'audio' ? 'volume' : 'image'
    }
    case 'youtube':
      return 'youtube'
    case 'notice':
      return 'megaphone'
  }
}

interface Props {
  items: ResolvedItem[]
  /** quantidade de slides por item (do outline) */
  slideCounts: Record<ID, number>
  library: MediaItem[]
  selectedId: ID | null
  liveId: ID | null
  cueId: ID | null
  online: boolean
  attachments: Record<ID, SongAttachment>
  onSelect: (id: ID) => void
  onAttachment: (r: ResolvedItem, att: NonNullable<SongAttachment>) => void
}

/** Ordem do culto como roteiro vertical: ícone do tipo, título, ponto Mint no item que está no ar. */
export function RunOfShow({ items, slideCounts, library, selectedId, liveId, cueId, online, attachments, onSelect, onAttachment }: Props): JSX.Element {
  return (
    <ol className="ros">
      {items.map((r, i) => {
        const att = r.item.data.kind === 'song' && !r.missing ? attachments[r.item.data.songId] : null
        const offline = r.item.data.kind === 'youtube' && !online
        const isLive = r.item.id === liveId
        const isCue = !isLive && r.item.id === cueId
        const classes = ['ros__item']
        if (r.missing) classes.push('ros__item--missing')
        if (offline) classes.push('ros__item--offline')
        if (isLive) classes.push('ros__item--live')
        const count = slideCounts[r.item.id] ?? 0
        const kind = strings.services.kind[r.item.data.kind]
        const meta = r.missing ? kind : count > 0 ? `${kind} · ${strings.songs.slideCount(count)}` : kind
        return (
          <li key={r.item.id} className={classes.join(' ')}>
            <button
              type="button"
              className={r.item.id === selectedId ? 'ros__row ros__row--selected' : 'ros__row'}
              aria-current={r.item.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(r.item.id)}
            >
              <span className="ros__num tnum">{String(i + 1).padStart(2, '0')}</span>
              <span className="ros__icon">
                <Icon name={offline ? 'wifiOff' : kindIcon(r.item.data, library)} size={16} />
              </span>
              <span className="ros__text">
                <span className="ros__title">{r.missing ? strings.operation.removedItem : r.title}</span>
                <span className="ros__meta">{offline ? strings.operation.offline : meta}</span>
              </span>
              {isLive && (
                <span className="ros__tally ros__tally--live">
                  <span className="visually-hidden">{strings.operation.liveTag}</span>
                </span>
              )}
              {isCue && (
                <span className="ros__tally ros__tally--cue">
                  <span className="visually-hidden">{strings.operation.cueTag}</span>
                </span>
              )}
            </button>
            {att && (
              <Button variant="ghost" icon="film" className="ros__attachment" onClick={() => onAttachment(r, att)}>
                {strings.operation.attachment}
              </Button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
