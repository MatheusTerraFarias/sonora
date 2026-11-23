import { useState } from 'react'
import { strings } from '../../shared/strings'
import { dayMonth, formatDate, todayIso, weekday } from '../format'
import type { ServiceSummary } from '../hooks'
import { Button } from './ui/Button'
import { Dialog } from './ui/Dialog'
import { EmptyState, Notice } from './ui/EmptyState'
import { Field } from './ui/Field'
import { PanelHeader } from './ui/PanelHeader'
import { useSafe } from './useSafe'

export type { ServiceSummary }

interface Props {
  services: ServiceSummary[]
  currentId: string | null
  onSelect: (id: string) => void
  /** chamado após criar; recebe o id a selecionar */
  onChanged: (selectId: string | null) => void | Promise<void>
}

function Row({ s, active, onSelect }: { s: ServiceSummary; active: boolean; onSelect: () => void }): JSX.Element {
  const { day, month } = dayMonth(s.date)
  return (
    <li>
      <button type="button" className={active ? 'row row--active' : 'row'} aria-current={active ? 'true' : undefined} onClick={onSelect}>
        <span className="date-tile" aria-hidden="true">
          <span className="date-tile__day tnum">{day}</span>
          <span className="date-tile__month">{month}</span>
        </span>
        <span className="row__text">
          <span className="row__title">{s.name}</span>
          <span className="row__meta">
            <span className="visually-hidden">{formatDate(s.date)} · </span>
            {weekday(s.date)}
          </span>
        </span>
      </button>
    </li>
  )
}

/** Lista de cultos agrupada por data (próximos / anteriores) + diálogo "Novo culto". */
export function ServiceList({ services, currentId, onSelect, onChanged }: Props): JSX.Element {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayIso())
  const [formError, setFormError] = useState<string | null>(null)
  const safe = useSafe()

  const today = todayIso()
  const upcoming = services.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = services.filter((s) => s.date < today).sort((a, b) => b.date.localeCompare(a.date))

  const open = (): void => {
    setName('')
    setDate(todayIso())
    setFormError(null)
    setCreating(true)
  }

  const create = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim()) return setFormError(strings.services.nameRequired)
    if (!date) return setFormError(strings.services.dateRequired)
    setFormError(null)
    const r = await safe.run(() => window.sonora.services.create(name.trim(), date))
    if (!r.ok) return
    setCreating(false)
    await onChanged(r.value.id)
  }

  const group = (label: string, list: ServiceSummary[]): JSX.Element | null =>
    list.length === 0 ? null : (
      <>
        <p className="group-label">{label}</p>
        <ul className="rows">
          {list.map((s) => (
            <Row key={s.id} s={s} active={s.id === currentId} onSelect={() => onSelect(s.id)} />
          ))}
        </ul>
      </>
    )

  return (
    <aside className="split__list">
      <PanelHeader
        level={1}
        title={strings.services.title}
        actions={
          <Button variant="primary" size="sm" icon="plus" onClick={open}>
            {strings.services.newTitle}
          </Button>
        }
      />
      <div className="split__scroll">
        {services.length === 0 ? (
          <div className="services__empty">
            <EmptyState icon="services" title={strings.services.emptyTitle} text={strings.services.emptyHint} compact />
          </div>
        ) : (
          <>
            {group(strings.services.upcoming, upcoming)}
            {group(strings.services.past, past)}
          </>
        )}
      </div>

      <Dialog open={creating} title={strings.services.newTitle} description={strings.services.newDescription} onClose={() => setCreating(false)}>
        <form className="dialog-form" onSubmit={create}>
          <Field label={strings.services.fieldName} error={formError === strings.services.nameRequired ? formError : null}>
            <input className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={strings.services.fieldDate} error={formError === strings.services.dateRequired ? formError : null}>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
          <div className="dialog-form__actions">
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {strings.common.cancel}
            </Button>
            <Button type="submit" variant="primary" icon="plus">
              {strings.services.create}
            </Button>
          </div>
        </form>
      </Dialog>
    </aside>
  )
}
