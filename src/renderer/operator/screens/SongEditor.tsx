import { useState } from 'react'
import type { ID, Song, SongAttachment } from '../../../shared/types'
import { serializeLyrics } from '../../../shared/lyrics'
import { parseTags } from '../../../shared/arrangement'
import { strings } from '../../shared/strings'
import { ArrangementChips } from '../components/ArrangementChips'
import { AttachmentField } from '../components/AttachmentField'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { SlideThumb } from '../components/SlideThumb'
import { ErrorBanner, useSafe } from '../components/useSafe'

interface Props {
  /** null = música nova */
  song: Song | null
  onSaved: (song: Song) => void
  onDeleted: () => void
}

/** Editor de uma música. O pai deve usar `key={song?.id ?? 'nova'}` para reiniciar o formulário. */
export function SongEditor({ song, onSaved, onDeleted }: Props): JSX.Element {
  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [key, setKey] = useState(song?.key ?? '')
  const [tags, setTags] = useState(song?.tags.join(', ') ?? '')
  const [lyrics, setLyrics] = useState(song ? serializeLyrics(song.parts, song.arrangement) : '')
  const [attachment, setAttachment] = useState<SongAttachment>(song?.attachment ?? null)
  const [attachmentValid, setAttachmentValid] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const safe = useSafe()

  const save = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) {
      setError(strings.songs.titleRequired)
      return
    }
    if (!attachmentValid) return
    setError(null)
    setStatus('saving')
    const input = { title: title.trim(), artist: artist.trim(), key: key.trim() || null, tags: parseTags(tags), lyrics, attachment }
    try {
      const saved = song ? await window.sonora.songs.update(song.id, input) : await window.sonora.songs.create(input)
      setStatus('saved')
      onSaved(saved)
    } catch {
      setStatus('error')
    }
  }

  const changeArrangement = async (arrangement: ID[]): Promise<void> => {
    if (!song) return
    try {
      onSaved(await window.sonora.songs.setArrangement(song.id, arrangement))
    } catch {
      setStatus('error')
    }
  }

  const remove = async (): Promise<void> => {
    if (!song || !window.confirm(strings.songs.confirmDelete)) return
    const r = await safe.run(() => window.sonora.songs.remove(song.id))
    if (r.ok) onDeleted()
  }

  return (
    <form className="form song-editor" onSubmit={save}>
      <div className="form__grid">
        <label className="form__row form__row--wide">
          <span>{strings.songs.fieldTitle}</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="form__row">
          <span>{strings.songs.fieldArtist}</span>
          <input className="field" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </label>
        <label className="form__row">
          <span>{strings.songs.fieldKey}</span>
          <input className="field" value={key} onChange={(e) => setKey(e.target.value)} />
        </label>
        <label className="form__row form__row--wide">
          <span>{strings.songs.fieldTags}</span>
          <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
      </div>

      <label className="form__row">
        <span>{strings.songs.fieldLyrics}</span>
        <textarea className="field field--lyrics" rows={14} value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
        <span className="hint">{strings.songs.lyricsHelp}</span>
      </label>

      <AttachmentField value={attachment} songTitle={title.trim()} onChange={(a, valid) => { setAttachment(a); setAttachmentValid(valid) }} />

      <div className="form__row">
        <span>{strings.songs.arrangement}</span>
        <ArrangementChips parts={song?.parts ?? []} arrangement={song?.arrangement ?? []} onChange={changeArrangement} />
      </div>

      {song && song.parts.length > 0 && (
        <div className="form__row">
          <span>{strings.songs.previewParts}</span>
          <div className="parts-grid">
            {song.parts.map((p) => (
              <SlideThumb key={p.id} label={p.label} text={p.slides.join('\n\n')} />
            ))}
          </div>
        </div>
      )}

      {error && <span className="hint hint--error">{error}</span>}
      {status === 'error' && <span className="hint hint--error">{strings.common.error}</span>}
      <ErrorBanner show={safe.error} />
      <div className="form__actions">
        <button type="submit" className="btn btn--primary" disabled={status === 'saving' || !attachmentValid}>
          {status === 'saving' ? strings.common.saving : status === 'saved' ? strings.common.saved : strings.common.save}
        </button>
        {song && <AddToServiceButton data={{ kind: 'song', songId: song.id }} />}
        {song && (
          <button type="button" className="btn btn--danger" onClick={remove}>
            {strings.songs.deleteSong}
          </button>
        )}
      </div>
    </form>
  )
}
