import { useCallback, useEffect, useState } from 'react'
import type { ID, MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { MediaThumb } from '../components/MediaThumb'
import { Button } from '../components/ui/Button'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { Icon, type IconName } from '../components/ui/Icon'
import { PanelHeader } from '../components/ui/PanelHeader'
import { useSafe } from '../components/useSafe'
import './Media.css'

const KIND_LABEL = { image: strings.media.kindImage, video: strings.media.kindVideo, audio: strings.media.kindAudio } as const
const KIND_ICON: Record<MediaItem['kind'], IconName> = { image: 'image', video: 'film', audio: 'volume' }

export function Media(): JSX.Element {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<ID | null>(null)
  const [importing, setImporting] = useState(false)
  const { error, run } = useSafe()

  const reload = useCallback(async (): Promise<void> => {
    const r = await run(() => window.sonora.media.list())
    if (r.ok) {
      setItems(r.value)
      setLoaded(true)
    }
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  const importFiles = async (): Promise<void> => {
    setImporting(true)
    const r = await run(() => window.sonora.media.pickAndImport())
    if (r.ok) {
      await reload()
      if (r.value[0]) setSelectedId(r.value[0].id)
    }
    setImporting(false)
  }

  const remove = async (m: MediaItem): Promise<void> => {
    if (!window.confirm(strings.media.confirmDelete)) return
    const r = await run(() => window.sonora.media.remove(m.id))
    if (r.ok) {
      setSelectedId(null)
      await reload()
    }
  }

  const selected = items.find((m) => m.id === selectedId) ?? null
  const importButton = (
    <Button variant="primary" size="sm" icon="upload" disabled={importing} onClick={importFiles}>
      {importing ? strings.media.importing : strings.media.import}
    </Button>
  )

  return (
    <section className="split media">
      <div className="split__list media__library">
        <PanelHeader level={1} title={strings.media.title} meta={loaded ? strings.media.count(items.length) : undefined} actions={importButton} />
        {error && (
          <div className="split__tools">
            <Notice tone="error">{strings.common.error}</Notice>
          </div>
        )}
        <div className="split__scroll media__scroll">
          {loaded && items.length === 0 ? (
            <EmptyState
              icon="image"
              title={strings.media.empty}
              text={strings.media.emptyHint}
              action={
                <Button variant="primary" icon="upload" disabled={importing} onClick={importFiles}>
                  {importing ? strings.media.importing : strings.media.import}
                </Button>
              }
            />
          ) : (
            <ul className="media-grid">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className={m.id === selectedId ? 'media-tile media-tile--active' : 'media-tile'}
                    aria-current={m.id === selectedId ? 'true' : undefined}
                    onClick={() => setSelectedId(m.id)}
                  >
                    <MediaThumb media={m} />
                    <span className="media-tile__caption">
                      <Icon name={KIND_ICON[m.kind]} size={14} />
                      <span className="media-tile__name" title={m.originalName}>
                        {m.originalName}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="split__detail media__detail">
        {selected ? (
          <>
            <PanelHeader title={selected.originalName} meta={KIND_LABEL[selected.kind]} />
            <div className="detail__scroll">
              <div className="media__detail-body">
                <MediaThumb media={selected} />
                <div className="media__actions">
                  <AddToServiceButton data={{ kind: 'media', mediaId: selected.id }} />
                  <Button variant="danger" icon="trash" onClick={() => void remove(selected)}>
                    {strings.common.delete}
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="detail__empty">
            <EmptyState icon="image" title={strings.media.pickTitle} text={strings.media.pickHint} compact />
          </div>
        )}
      </aside>
    </section>
  )
}
