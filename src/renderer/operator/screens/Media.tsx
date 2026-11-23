import { useCallback, useEffect, useState } from 'react'
import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { MediaThumb } from '../components/MediaThumb'
import { ErrorBanner, useSafe } from '../components/useSafe'

export function Media(): JSX.Element {
  const [items, setItems] = useState<MediaItem[]>([])
  const [importing, setImporting] = useState(false)
  const { error, run } = useSafe()

  const reload = useCallback(async (): Promise<void> => {
    const r = await run(() => window.sonora.media.list())
    if (r.ok) setItems(r.value)
  }, [run])

  useEffect(() => {
    void reload()
  }, [reload])

  const importFiles = async (): Promise<void> => {
    setImporting(true)
    const r = await run(() => window.sonora.media.pickAndImport())
    if (r.ok) await reload()
    setImporting(false)
  }

  const remove = async (m: MediaItem): Promise<void> => {
    if (!window.confirm(strings.media.confirmDelete)) return
    const r = await run(() => window.sonora.media.remove(m.id))
    if (r.ok) await reload()
  }

  return (
    <section className="screen">
      <h1 className="screen__title">{strings.media.title}</h1>
      <div className="toolbar">
        <button type="button" className="btn btn--primary" disabled={importing} onClick={importFiles}>
          {importing ? strings.media.importing : strings.media.import}
        </button>
        <ErrorBanner show={error} />
      </div>
      {items.length === 0 && <p className="hint">{strings.media.empty}</p>}
      <ul className="media-grid">
        {items.map((m) => (
          <li key={m.id} className="media-card">
            <MediaThumb media={m} />
            <span className="media-card__name" title={m.originalName}>
              {m.originalName}
            </span>
            <div className="media-card__actions">
              <AddToServiceButton data={{ kind: 'media', mediaId: m.id }} />
              <button type="button" className="btn btn--danger" onClick={() => remove(m)}>
                {strings.common.delete}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
