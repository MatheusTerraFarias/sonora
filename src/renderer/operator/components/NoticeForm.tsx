import { useEffect, useState } from 'react'
import type { MediaItem } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { Button } from './ui/Button'
import { Notice } from './ui/EmptyState'
import { Field } from './ui/Field'
import { useSafe } from './useSafe'

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
  /** acompanha o rascunho (prévia ao vivo) */
  onDraftChange?: (data: NoticeData) => void
  /** mostra "Cancelar" ao lado do envio (diálogos) */
  onCancel?: () => void
  autoFocus?: boolean
}

/** Formulário reutilizável de aviso: título, corpo e fundo opcional (da biblioteca de mídias). */
export function NoticeForm({ onSubmit, submitLabel = strings.notices.submit, disabled, initial, onDraftChange, onCancel, autoFocus }: Props): JSX.Element {
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

  useEffect(() => {
    onDraftChange?.({ title, body, backgroundMediaId: bg || null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, bg])

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
    <form className="dialog-form" onSubmit={submit}>
      <Field label={strings.notices.fieldTitle} error={error}>
        <input className="input" value={title} disabled={disabled} autoFocus={autoFocus} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={strings.notices.fieldBody}>
        <textarea className="input" rows={5} value={body} disabled={disabled} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <Field label={strings.notices.fieldBackground}>
        <select className="input" value={bg} disabled={disabled} onChange={(e) => setBg(e.target.value)}>
          <option value="">{strings.notices.noBackground}</option>
          {media.map((m) => (
            <option key={m.id} value={m.id}>
              {m.originalName}
            </option>
          ))}
        </select>
      </Field>
      {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
      <div className={onCancel ? 'dialog-form__actions' : 'inline-actions'}>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {strings.common.cancel}
          </Button>
        )}
        <Button type="submit" variant="primary" icon={initial ? 'check' : 'plus'} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
