import { useState } from 'react'
import type { Service } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { ErrorBanner, useSafe } from './useSafe'

export type ServiceSummary = Omit<Service, 'items'>

export const todayIso = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const formatDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

interface Props {
  services: ServiceSummary[]
  currentId: string | null
  onSelect: (id: string) => void
  /** chamado após criar/duplicar/apagar; recebe o id a selecionar (ou null) */
  onChanged: (selectId: string | null) => void | Promise<void>
}

/** Lista de cultos com criação (nome + data), duplicação e exclusão. */
export function ServiceList({ services, currentId, onSelect, onChanged }: Props): JSX.Element {
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayIso())
  const [dupDate, setDupDate] = useState(todayIso())
  const [formError, setFormError] = useState<string | null>(null)
  const safe = useSafe()

  const create = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return setFormError(strings.services.nameRequired)
    if (!date) return setFormError(strings.services.dateRequired)
    setFormError(null)
    const r = await safe.run(() => window.sonora.services.create(name.trim(), date))
    if (!r.ok) return
    setName('')
    await onChanged(r.value.id)
  }

  const duplicate = async (): Promise<void> => {
    if (!currentId || !dupDate) return
    const r = await safe.run(() => window.sonora.services.duplicate(currentId, dupDate))
    if (r.ok) await onChanged(r.value.id)
  }

  const remove = async (): Promise<void> => {
    if (!currentId || !window.confirm(strings.services.confirmDelete)) return
    const r = await safe.run(() => window.sonora.services.remove(currentId))
    if (r.ok) await onChanged(null)
  }

  return (
    <div className="list-pane">
      <form className="form" onSubmit={create}>
        <h2 className="pane-title">{strings.services.newTitle}</h2>
        <label className="form__row">
          <span>{strings.services.fieldName}</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="form__row">
          <span>{strings.services.fieldDate}</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {formError && <span className="hint hint--error">{formError}</span>}
        <div>
          <button type="submit" className="btn btn--primary">
            {strings.services.create}
          </button>
        </div>
      </form>
      <ErrorBanner show={safe.error} />
      <h2 className="pane-title">{strings.services.listTitle}</h2>
      {services.length === 0 ? (
        <p className="hint">{strings.services.empty}</p>
      ) : (
        <ul className="list">
          {services.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === currentId ? 'list__item list__item--active' : 'list__item'}
                aria-current={s.id === currentId ? 'true' : undefined}
                onClick={() => onSelect(s.id)}
              >
                <span>{s.name}</span>
                <small>{formatDate(s.date)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {currentId && (
        <div className="form">
          <label className="form__row">
            <span>{strings.services.duplicateDate}</span>
            <input className="field" type="date" value={dupDate} onChange={(e) => setDupDate(e.target.value)} />
          </label>
          <div className="form__actions">
            <button type="button" className="btn" onClick={duplicate}>
              {strings.services.duplicate}
            </button>
            <button type="button" className="btn btn--danger" onClick={remove}>
              {strings.services.delete}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
