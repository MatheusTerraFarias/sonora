import { useCallback, useEffect, useState } from 'react'
import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { MediaThumb } from '../components/MediaThumb'

export function Media(): JSX.Element {
  const [items, setItems] = useState<MediaItem[]>([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(false)

  const reload = useCallback(async (): Promise<void> => {
    setItems(await window.sonora.media.list())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const importFiles = async (): Promise<void> => {
    setImporting(true)
    setError(false)
    try {
      await window.sonora.media.pickAndImport()
      await reload()
    } catch {
      setError(true)
    } finally {
      setImporting(false)
    }
  }

  const remove = async (m: MediaItem): Promise<void> => {
    if (!window.confirm(strings.media.confirmDelete)) return
    await window.sonora.media.remove(m.id)
    await reload()
  }

  return (
    <section className="screen">
      <h1 className="screen__title">{strings.media.title}</h1>
      <div className="toolbar">
        <button type="button" className="btn btn--primary" disabled={importing} onClick={importFiles}>
          {importing ? strings.media.importing : strings.media.import}
        </button>
        {error && <span className="hint hint--error">{strings.common.error}</span>}
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
