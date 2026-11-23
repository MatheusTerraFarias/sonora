import { useCallback, useEffect, useRef, useState } from 'react'
import type { Song } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { Button } from '../components/ui/Button'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { SearchField } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { PanelHeader } from '../components/ui/PanelHeader'
import { useSafe } from '../components/useSafe'
import { SongEditor } from './SongEditor'
import './Songs.css'

type Selection = Song | 'new' | null

export function Songs(): JSX.Element {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selection, setSelection] = useState<Selection>(null)

  const { error, run } = useSafe()
  const latest = useRef(0)

  const reload = useCallback(async (): Promise<void> => {
    const id = ++latest.current
    const r = await run(() => window.sonora.songs.list(query))
    // ignora resposta de uma busca mais antiga
    if (r.ok && id === latest.current) {
      setSongs(r.value)
      setLoaded(true)
    }
  }, [query, run])

  useEffect(() => {
    void reload()
  }, [reload])

  const selected = selection && selection !== 'new' ? selection : null
  const newButton = (
    <Button variant="primary" size="sm" icon="plus" onClick={() => setSelection('new')}>
      {strings.songs.newSong}
    </Button>
  )

  return (
    <section className="split songs">
      <aside className="split__list">
        <PanelHeader level={1} title={strings.songs.title} meta={loaded ? strings.songs.count(songs.length) : undefined} actions={newButton} />
        <div className="split__tools">
          <SearchField value={query} onChange={setQuery} label={strings.common.search} placeholder={strings.songs.searchPlaceholder} />
          {error && <Notice tone="error">{strings.common.error}</Notice>}
        </div>
        <div className="split__scroll">
          {loaded && songs.length === 0 && (
            <div className="songs__empty">
              {query.trim() ? (
                <EmptyState icon="search" title={strings.songs.empty} compact />
              ) : (
                <EmptyState icon="music" title={strings.songs.emptyLibrary} text={strings.songs.emptyLibraryHint} compact />
              )}
            </div>
          )}
          <ul className="rows">
            {songs.map((s) => {
              const meta = [s.artist, s.key ? `${strings.songs.fieldKey} ${s.key}` : ''].filter(Boolean).join(' · ')
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={selected?.id === s.id ? 'row row--active' : 'row'}
                    aria-current={selected?.id === s.id ? 'true' : undefined}
                    onClick={() => setSelection(s)}
                  >
                    <span className="row__icon">
                      <Icon name="music" size={16} />
                    </span>
                    <span className="row__text">
                      <span className="row__title">{s.title}</span>
                      {meta && <span className="row__meta">{meta}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
      <div className="split__detail">
        {selection === null ? (
          <div className="detail__empty">
            <EmptyState
              icon="music"
              title={strings.songs.pickTitle}
              text={strings.songs.pickOrCreate}
              action={
                <Button variant="primary" icon="plus" onClick={() => setSelection('new')}>
                  {strings.songs.newSong}
                </Button>
              }
            />
          </div>
        ) : (
          <SongEditor
            key={selected?.id ?? 'nova'}
            song={selected}
            onSaved={(s) => {
              setSelection(s)
              void reload()
            }}
            onDeleted={() => {
              setSelection(null)
              void reload()
            }}
          />
        )}
      </div>
    </section>
  )
}
