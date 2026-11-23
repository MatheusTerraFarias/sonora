import { useCallback, useEffect, useState } from 'react'
import type { Song } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { SearchBox } from '../components/SearchBox'
import { SongEditor } from './SongEditor'

type Selection = Song | 'new' | null

export function Songs(): JSX.Element {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [selection, setSelection] = useState<Selection>(null)

  const reload = useCallback(async (): Promise<void> => {
    setSongs(await window.sonora.songs.list(query))
  }, [query])

  useEffect(() => {
    void reload()
  }, [reload])

  const selected = selection && selection !== 'new' ? selection : null

  return (
    <section className="screen screen--split">
      <aside className="list-pane">
        <h1 className="screen__title">{strings.songs.title}</h1>
        <SearchBox value={query} onChange={setQuery} placeholder={strings.songs.searchPlaceholder} />
        <button type="button" className="btn btn--primary" onClick={() => setSelection('new')}>
          {strings.songs.newSong}
        </button>
        <ul className="list">
          {songs.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={selected?.id === s.id ? 'list__item list__item--active' : 'list__item'}
                onClick={() => setSelection(s)}
              >
                <strong>{s.title}</strong>
                {s.artist && <small>{s.artist}</small>}
              </button>
            </li>
          ))}
        </ul>
        {songs.length === 0 && <p className="hint">{strings.songs.empty}</p>}
      </aside>
      <div className="detail-pane">
        {selection === null ? (
          <p className="hint">{strings.songs.pickOrCreate}</p>
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
