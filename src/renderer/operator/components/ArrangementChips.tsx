import { useEffect, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ID, SongPart } from '../../../shared/types'
import { appendToArrangement, moveInArrangement, removeFromArrangement } from '../../../shared/arrangement'
import { strings } from '../../shared/strings'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import './ArrangementChips.css'

interface Chip {
  key: string
  partId: ID
}

interface Props {
  parts: SongPart[]
  arrangement: ID[]
  onChange: (arrangement: ID[]) => void
}

function Sortable({ chip, label, onRemove }: { chip: Chip; label: string; onRemove: () => void }): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chip.key })
  return (
    <li
      ref={setNodeRef}
      className={isDragging ? 'chip chip--dragging' : 'chip'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      title={strings.songs.dragChip}
    >
      <span>{label}</span>
      <button
        type="button"
        className="chip__remove"
        aria-label={`${strings.songs.removeChip}: ${label}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
      >
        <Icon name="close" size={12} />
      </button>
    </li>
  )
}

/** Arranjo da música como chips arrastáveis; o mesmo bloco pode aparecer várias vezes. */
export function ArrangementChips({ parts, arrangement, onChange }: Props): JSX.Element {
  const counter = useRef(0)
  const makeChips = (ids: ID[]): Chip[] => ids.map((partId) => ({ key: `chip-${counter.current++}`, partId }))
  const [chips, setChips] = useState<Chip[]>(() => makeChips(arrangement))
  const [addId, setAddId] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const labelOf = (id: ID): string => parts.find((p) => p.id === id)?.label ?? id

  // o arranjo salvo mudou por fora (ex.: letra salva): reconstrói os chips
  const lastSent = useRef<string>(JSON.stringify(arrangement))
  useEffect(() => {
    const incoming = JSON.stringify(arrangement)
    if (incoming !== lastSent.current) {
      lastSent.current = incoming
      setChips(makeChips(arrangement))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement])

  const commit = (next: Chip[]): void => {
    setChips(next)
    const ids = next.map((c) => c.partId)
    lastSent.current = JSON.stringify(ids)
    onChange(ids)
  }

  const onDragEnd = (e: DragEndEvent): void => {
    if (!e.over || e.active.id === e.over.id) return
    const keys = chips.map((c) => c.key)
    const order = moveInArrangement(keys, keys.indexOf(String(e.active.id)), keys.indexOf(String(e.over.id)))
    commit(order.map((k) => chips.find((c) => c.key === k)!))
  }

  const remove = (index: number): void => {
    const keys = removeFromArrangement(chips.map((c) => c.key), index)
    commit(keys.map((k) => chips.find((c) => c.key === k)!))
  }

  const add = (): void => {
    const id = addId || parts[0]?.id
    if (!id) return
    const ids = appendToArrangement(chips.map((c) => c.partId), id)
    commit([...chips, makeChips(ids.slice(-1))[0]])
  }

  return (
    <div className="arrangement">
      {chips.length === 0 ? (
        <p className="hint">{strings.songs.arrangementEmpty}</p>
      ) : (
        <>
          <p className="hint">{strings.songs.arrangementHelp}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={chips.map((c) => c.key)} strategy={horizontalListSortingStrategy}>
              <ul className="arrangement__list">
                {chips.map((c, i) => (
                  <Sortable key={c.key} chip={c} label={labelOf(c.partId)} onRemove={() => remove(i)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
      {parts.length > 0 && (
        <div className="arrangement__add">
          <select className="input" aria-label={strings.songs.addPart} value={addId || parts[0].id} onChange={(e) => setAddId(e.target.value)}>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <Button size="sm" icon="plus" onClick={add}>
            {strings.songs.addPartButton}
          </Button>
        </div>
      )}
    </div>
  )
}
