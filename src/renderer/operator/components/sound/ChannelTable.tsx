import { memo, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ID } from '../../../../shared/types'
import type { ChannelKind, SoundChannel } from '../../../../shared/sound'
import { SILENCE_DB } from '../../../../shared/meter'
import { strings } from '../../../shared/strings'
import type { ChannelReadings, ReadingsListener } from '../../sound/useMeters'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { MeterBar, dbToFraction, type MeterBarHandle } from './MeterBar'

const S = strings.sound
const KINDS: ChannelKind[] = ['wireless', 'wired', 'line', 'other']
const SCALE = [SILENCE_DB, -48, -36, -24, -12, 0]
/** quantas entradas oferecer no seletor quando o dispositivo ainda não disse quantas tem */
const DEFAULT_INPUTS = 32

interface RowProps {
  channel: SoundChannel
  inputOptions: number
  autoFocus: boolean
  onChange: (id: ID, patch: Partial<SoundChannel>) => void
  onRemove: (id: ID) => void
  registerBar: (id: ID, bar: MeterBarHandle | null) => void
}

const ChannelRow = memo(function ChannelRow({ channel: c, inputOptions, autoFocus, onChange, onRemove, registerBar }: RowProps): JSX.Element {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: c.id })
  const label = c.name.trim() || S.namePlaceholder
  const barRef = useCallback((h: MeterBarHandle | null) => registerBar(c.id, h), [registerBar, c.id])
  const count = Math.max(inputOptions, (c.inputIndex ?? -1) + 1)
  return (
    <tr
      ref={setNodeRef}
      className={isDragging ? 'ch-row ch-row--dragging' : 'ch-row'}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <td className="ch-cell ch-cell--grip">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="ch-grip"
          aria-label={`${S.dragChannel}: ${label}`}
          title={S.dragChannel}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={16} />
        </button>
      </td>
      <td className="ch-cell ch-cell--num tnum">{c.number}</td>
      <td className="ch-cell">
        <input
          className="cell-input cell-input--strong"
          value={c.name}
          placeholder={S.namePlaceholder}
          aria-label={`${S.colName} ${c.number}`}
          autoFocus={autoFocus}
          onChange={(e) => onChange(c.id, { name: e.target.value })}
        />
      </td>
      <td className="ch-cell">
        <input
          className="cell-input"
          value={c.person}
          placeholder={S.personPlaceholder}
          aria-label={`${S.colPerson} ${c.number}`}
          onChange={(e) => onChange(c.id, { person: e.target.value })}
        />
      </td>
      <td className="ch-cell">
        <select
          className="cell-input cell-select"
          value={c.kind}
          aria-label={`${S.colKind} ${c.number}`}
          onChange={(e) => onChange(c.id, { kind: e.target.value as ChannelKind })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {S.kind[k]}
            </option>
          ))}
        </select>
      </td>
      <td className="ch-cell">
        {/* 1-based na tela, 0-based no dado */}
        <select
          className="cell-input cell-select tnum"
          value={c.inputIndex === null ? '' : String(c.inputIndex)}
          aria-label={`${S.colInput} ${c.number}`}
          onChange={(e) => onChange(c.id, { inputIndex: e.target.value === '' ? null : Number(e.target.value) })}
        >
          <option value="">{S.noInputOption}</option>
          {Array.from({ length: count }, (_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </select>
      </td>
      <td className="ch-cell ch-cell--meter">
        <MeterBar ref={barRef} label={`${S.colLevel}: ${label}`} />
      </td>
      <td className="ch-cell">
        <input
          className="cell-input"
          value={c.notes}
          placeholder={S.notesPlaceholder}
          aria-label={`${S.notesLabel} ${c.number}`}
          onChange={(e) => onChange(c.id, { notes: e.target.value })}
        />
      </td>
      <td className="ch-cell ch-cell--actions">
        <Button variant="danger" size="sm" icon="trash" iconOnly aria-label={`${S.removeChannel}: ${label}`} title={S.removeChannel} onClick={() => onRemove(c.id)}>
          {S.removeChannel}
        </Button>
      </td>
    </tr>
  )
})

interface Props {
  channels: SoundChannel[]
  /** entradas do dispositivo quando o motor está lendo */
  inputCount: number | null
  focusId: ID | null
  subscribe: (cb: ReadingsListener) => () => void
  onChange: (id: ID, patch: Partial<SoundChannel>) => void
  onRemove: (id: ID) => void
  onMove: (from: number, to: number) => void
}

/**
 * Tabela de canais editável no lugar, reordenável por arraste. Os medidores são escritos
 * fora do React: uma assinatura de leituras + um requestAnimationFrame por quadro.
 */
export function ChannelTable({ channels, inputCount, focusId, subscribe, onChange, onRemove, onMove }: Props): JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const bars = useRef(new Map<ID, MeterBarHandle>())
  const latest = useRef<ChannelReadings>(null)
  const channelsRef = useRef(channels)
  channelsRef.current = channels

  const paint = useCallback((id: ID, bar: MeterBarHandle): void => {
    const r = latest.current
    if (r) bar.set(r[id] ?? 'no-input')
    else {
      // motor parado: canal sem entrada continua "sem entrada"; os demais ficam em repouso
      const c = channelsRef.current.find((x) => x.id === id)
      bar.set(c && c.inputIndex === null ? 'no-input' : null)
    }
  }, [])

  const registerBar = useCallback(
    (id: ID, bar: MeterBarHandle | null) => {
      if (bar) {
        bars.current.set(id, bar)
        paint(id, bar)
      } else bars.current.delete(id)
    },
    [paint]
  )

  useEffect(() => {
    let frame = 0
    const off = subscribe((readings) => {
      latest.current = readings
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        for (const [id, bar] of bars.current) paint(id, bar)
      })
    })
    return () => {
      off()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [subscribe, paint])

  const onDragEnd = (e: DragEndEvent): void => {
    if (!e.over || e.active.id === e.over.id) return
    const ids = channels.map((c) => c.id)
    onMove(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)))
  }

  // o mapa pode ser montado longe da mesa: oferece ao menos DEFAULT_INPUTS entradas
  const options = Math.max(inputCount ?? 0, DEFAULT_INPUTS)
  return (
    <table className="ch-table">
      <colgroup>
        <col className="ch-col--grip" />
        <col className="ch-col--num" />
        <col className="ch-col--name" />
        <col className="ch-col--person" />
        <col className="ch-col--kind" />
        <col className="ch-col--input" />
        <col className="ch-col--meter" />
        <col className="ch-col--notes" />
        <col className="ch-col--actions" />
      </colgroup>
      <thead>
        <tr>
          <th aria-label={S.dragChannel} />
          <th scope="col" className="ch-th--num">
            {S.colNumber}
          </th>
          <th scope="col">{S.colName}</th>
          <th scope="col">{S.colPerson}</th>
          <th scope="col">{S.colKind}</th>
          <th scope="col">{S.colInput}</th>
          <th scope="col">
            <div className="meter-scale">
              <span className="meter-scale__track" aria-hidden="true">
                {SCALE.map((db) => (
                  <span key={db} className="meter-scale__tick tnum" style={{ left: `${dbToFraction(db) * 100}%` }}>
                    {db}
                  </span>
                ))}
              </span>
              <span className="meter-scale__title">{S.colLevel}</span>
            </div>
          </th>
          <th scope="col">{S.colNotes}</th>
          <th aria-label={S.removeChannel} />
        </tr>
      </thead>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={channels.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <tbody>
            {channels.map((c) => (
              <ChannelRow
                key={c.id}
                channel={c}
                inputOptions={options}
                autoFocus={c.id === focusId}
                onChange={onChange}
                onRemove={onRemove}
                registerBar={registerBar}
              />
            ))}
          </tbody>
        </SortableContext>
      </DndContext>
    </table>
  )
}
