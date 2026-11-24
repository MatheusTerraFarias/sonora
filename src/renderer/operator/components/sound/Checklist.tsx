import type { ID } from '../../../../shared/types'
import type { ChecklistItem } from '../../../../shared/sound'
import { strings } from '../../../shared/strings'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

const S = strings.sound

interface Props {
  items: ChecklistItem[]
  /** null = sem culto escolhido: itens editáveis, sem marcar */
  checked: ID[] | null
  focusId: ID | null
  onToggle: (id: ID, done: boolean) => void
  onEdit: (id: ID, text: string) => void
  onAdd: () => void
  onRemove: (id: ID) => void
  /** ações do mapa, à direita do título */
  actions?: React.ReactNode
}

/** Passagem de som do culto: marcar grava no culto; o texto dos itens é do mapa. */
export function Checklist({ items, checked, focusId, onToggle, onEdit, onAdd, onRemove, actions }: Props): JSX.Element {
  const done = checked ? items.filter((i) => checked.includes(i.id)).length : 0
  return (
    <section className="checklist" aria-labelledby="checklist-title">
      <header className="checklist__head">
        <h2 id="checklist-title" className="checklist__title">
          {S.checklistTitle}
        </h2>
        {checked && items.length > 0 && (
          <span className={done === items.length ? 'checklist__progress checklist__progress--done tnum' : 'checklist__progress tnum'}>
            {S.checklistProgress(done, items.length)}
          </span>
        )}
        <Button variant="ghost" size="sm" icon="plus" aria-label={S.addChecklistItemLabel} onClick={onAdd}>
          {S.addChecklistItem}
        </Button>
        {actions && <div className="checklist__actions">{actions}</div>}
      </header>
      {!checked && <p className="hint">{S.checklistNoService}</p>}
      {items.length === 0 ? (
        <p className="hint">{S.checklistEmpty}</p>
      ) : (
        <ul className="checklist__items">
          {items.map((it, i) => {
            const isDone = !!checked?.includes(it.id)
            return (
              <li key={it.id} className={isDone ? 'check-item check-item--done' : 'check-item'}>
                {checked && (
                  <label className="check-item__box">
                    <input
                      type="checkbox"
                      checked={isDone}
                      aria-label={`${S.checklistCheck}: ${it.text || S.checklistItemLabel(i + 1)}`}
                      onChange={(e) => onToggle(it.id, e.target.checked)}
                    />
                    <span className="check-item__mark" aria-hidden="true">
                      <Icon name="check" size={14} />
                    </span>
                  </label>
                )}
                <input
                  className="cell-input check-item__text"
                  value={it.text}
                  aria-label={S.checklistItemLabel(i + 1)}
                  autoFocus={it.id === focusId}
                  onChange={(e) => onEdit(it.id, e.target.value)}
                />
                <Button
                  variant="danger"
                  size="sm"
                  icon="close"
                  iconOnly
                  aria-label={`${S.removeChecklistItem}: ${it.text || S.checklistItemLabel(i + 1)}`}
                  title={S.removeChecklistItem}
                  onClick={() => onRemove(it.id)}
                >
                  {S.removeChecklistItem}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
