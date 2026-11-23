import { useEffect, useState } from 'react'
import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'

export interface NoticeData {
  title: string
  body: string
  backgroundMediaId: string | null
}

interface Props {
  onSubmit: (data: NoticeData) => void | Promise<void>
  submitLabel?: string
  disabled?: boolean
}

/** Formulário reutilizável de aviso: título, corpo e fundo opcional (da biblioteca de mídias). */
export function NoticeForm({ onSubmit, submitLabel = strings.notices.submit, disabled }: Props): JSX.Element {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [bg, setBg] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.sonora.media.list().then((all) => setMedia(all.filter((m) => m.kind !== 'audio')))
  }, [])

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!title.trim()) {
      setError(strings.notices.titleRequired)
      return
    }
    setError(null)
    await onSubmit({ title: title.trim(), body, backgroundMediaId: bg || null })
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
      {error && <span className="hint hint--error">{error}</span>}
      <div>
        <button type="submit" className="btn btn--primary" disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
