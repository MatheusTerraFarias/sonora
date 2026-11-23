import { useEffect, useState } from 'react'
import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { ErrorBanner, useSafe } from './useSafe'

export interface NoticeData {
  title: string
  body: string
  backgroundMediaId: string | null
}

interface Props {
  /** retorna true quando o aviso foi salvo; o formulário só é limpo nesse caso */
  onSubmit: (data: NoticeData) => boolean | Promise<boolean>
  submitLabel?: string
  disabled?: boolean
  /** edição: preenche o formulário e não o limpa ao salvar */
  initial?: NoticeData
}

/** Formulário reutilizável de aviso: título, corpo e fundo opcional (da biblioteca de mídias). */
export function NoticeForm({ onSubmit, submitLabel = strings.notices.submit, disabled, initial }: Props): JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [bg, setBg] = useState(initial?.backgroundMediaId ?? '')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const safe = useSafe()

  useEffect(() => {
    void safe.run(() => window.sonora.media.list()).then((r) => {
      if (r.ok) setMedia(r.value.filter((m) => m.kind !== 'audio'))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) {
      setError(strings.notices.titleRequired)
      return
    }
    setError(null)
    const ok = await onSubmit({ title: title.trim(), body, backgroundMediaId: bg || null })
    if (!ok || initial) return
    setTitle('')
    setBody('')
    setBg('')
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="form__row">
        <span>{strings.notices.fieldTitle}</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="form__row">
        <span>{strings.notices.fieldBody}</span>
        <textarea className="field" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="form__row">
        <span>{strings.notices.fieldBackground}</span>
        <select className="field" value={bg} onChange={(e) => setBg(e.target.value)}>
          <option value="">{strings.notices.noBackground}</option>
          {media.map((m) => (
            <option key={m.id} value={m.id}>
              {m.originalName}
            </option>
          ))}
        </select>
      </label>
      <ErrorBanner show={safe.error} />
      {error && <span className="hint hint--error">{error}</span>}
      <div>
        <button type="submit" className="btn btn--primary" disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
