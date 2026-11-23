import { useState } from 'react'
import type { ID, Song, SongAttachment } from '../../../shared/types'
import { serializeLyrics } from '../../../shared/lyrics'
import { parseTags } from '../../../shared/arrangement'
import { strings } from '../../shared/strings'
import { ArrangementChips } from '../components/ArrangementChips'
import { AttachmentField } from '../components/AttachmentField'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { PanelHeader } from '../components/ui/PanelHeader'
import { SlideCanvas } from '../components/ui/SlideCanvas'
import { useSafe } from '../components/useSafe'
import { useLiveState } from '../hooks'

interface Props {
  /** null = música nova */
  song: Song | null
  onSaved: (song: Song) => void
  onDeleted: () => void
}

const FORM_ID = 'song-form'

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
  const live = useLiveState()

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

  const slides = song ? song.parts.flatMap((p) => p.slides.map((text, i) => ({ part: p, text, i, of: p.slides.length }))) : []
  const meta = song
    ? [song.artist, song.key ? `${strings.songs.fieldKey} ${song.key}` : '', strings.songs.slideCount(slides.length)].filter(Boolean).join(' · ')
    : strings.songs.newSongHint

  return (
    <>
      <PanelHeader
        level={2}
        title={song ? song.title : strings.songs.newSong}
        meta={meta}
        actions={
          <>
            {song && (
              <Button variant="danger" icon="trash" iconOnly onClick={remove}>
                {strings.songs.deleteSong}
              </Button>
            )}
            {song && <AddToServiceButton variant="secondary" data={{ kind: 'song', songId: song.id }} />}
            <Button type="submit" form={FORM_ID} variant="primary" icon="check" disabled={status === 'saving' || !attachmentValid}>
              {status === 'saving' ? strings.common.saving : status === 'saved' ? strings.common.saved : strings.common.save}
            </Button>
          </>
        }
      />
      <div className="detail__scroll">
        <div className="detail__body song-editor">
          {(error || status === 'error' || safe.error) && (
            <div className="stack">
              {error && <Notice tone="error">{error}</Notice>}
              {(status === 'error' || safe.error) && <Notice tone="error">{strings.common.error}</Notice>}
            </div>
          )}
          <div className="song-editor__grid">
            <form id={FORM_ID} className="stack" onSubmit={save}>
              <h3 className="section-title">{strings.songs.detailsSection}</h3>
              <Field label={strings.songs.fieldTitle}>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <div className="song-editor__meta">
                <Field label={strings.songs.fieldArtist}>
                  <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} />
                </Field>
                <Field label={strings.songs.fieldKey}>
                  <input className="input" value={key} onChange={(e) => setKey(e.target.value)} />
                </Field>
              </div>
              <Field label={strings.songs.fieldTags}>
                <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
              </Field>
              <Field label={strings.songs.fieldLyrics} hint={strings.songs.lyricsHelp}>
                <textarea className="input song-editor__lyrics" rows={16} value={lyrics} onChange={(e) => setLyrics(e.target.value)} />
              </Field>
              <AttachmentField
                value={attachment}
                songTitle={title.trim()}
                onChange={(a, valid) => {
                  setAttachment(a)
                  setAttachmentValid(valid)
                }}
              />
            </form>

            <div className="stack">
              <div>
                <h3 className="section-title">{strings.songs.arrangement}</h3>
                <ArrangementChips parts={song?.parts ?? []} arrangement={song?.arrangement ?? []} onChange={changeArrangement} />
              </div>
              {song && slides.length > 0 && live && (
                <div>
                  <h3 className="section-title">{strings.songs.previewSection}</h3>
                  <ul className="preview-grid song-editor__preview">
                    {slides.map((s) => (
                      <li key={`${s.part.id}-${s.i}`} className="preview-grid__item">
                        <SlideCanvas slide={{ label: s.part.label, text: s.text }} background={live.background} style={live.style} />
                        <span className="preview-grid__caption">
                          <strong>{s.part.label}</strong>
                          {s.of > 1 && (
                            <span className="tnum">
                              {s.i + 1}/{s.of}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
