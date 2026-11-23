import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ResolvedItem, ServiceItemData } from '../../../shared/types'
import { moveInArrangement } from '../../../shared/arrangement'
import { strings } from '../../shared/strings'
import { NoticeForm, type NoticeData } from '../components/NoticeForm'
import { ServiceList, formatDate, type ServiceSummary } from '../components/ServiceList'
import { ErrorBanner, useSafe } from '../components/useSafe'
import { useOperatorStore } from '../store'
import '../components/Operate.css'

function ItemRow({ r, onRemove, onEdit }: { r: ResolvedItem; onRemove: () => void; onEdit?: () => void }): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.item.id })
  const kind = strings.services.kind[r.item.data.kind]
  return (
    <li
      ref={setNodeRef}
      className={`service-item${r.missing ? ' service-item--missing' : ''}${isDragging ? ' service-item--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      title={strings.services.dragItem}
    >
      <span className="service-item__kind">{kind}</span>
      <span className="service-item__title">{r.missing ? strings.services.removedItem : r.title}</span>
      {onEdit && !r.missing && (
        <button type="button" className="btn" onPointerDown={(e) => e.stopPropagation()} onClick={onEdit}>
          {strings.services.editNotice}
        </button>
      )}
      <button
        type="button"
        className="btn btn--danger"
        aria-label={`${strings.services.removeItem}: ${r.title}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onRemove}
      >
        {strings.common.remove}
      </button>
    </li>
  )
}

/** Cultos: criar, escolher (define o culto atual) e ordenar os itens arrastando. */
export function Services(): JSX.Element {
  const currentId = useOperatorStore((s) => s.currentServiceId)
  const setCurrentId = useOperatorStore((s) => s.setCurrentServiceId)
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [items, setItems] = useState<ResolvedItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const safe = useSafe()
  const safeRun = safe.run
  const seq = useRef(0)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const loadItems = useCallback(
    async (id: string | null): Promise<void> => {
      const mine = ++seq.current
      if (!id) {
        setItems([])
        return
      }
      const r = await safeRun(() => window.sonora.services.resolve(id))
      if (mine === seq.current && r.ok) setItems(r.value)
    },
    [safeRun]
  )

  const loadServices = useCallback(async (): Promise<ServiceSummary[] | null> => {
    const r = await safeRun(() => window.sonora.services.list())
    if (!r.ok) return null
    setServices(r.value)
    return r.value
  }, [safeRun])

  useEffect(() => {
    void loadServices().then((list) => {
      // culto atual que já não existe (apagado): desmarca
      if (list && currentId && !list.some((s) => s.id === currentId)) setCurrentId(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setEditingId(null)
    void loadItems(currentId)
  }, [currentId, loadItems])

  /** depois de qualquer mudança nos itens: recarrega a lista e o cache do controle ao vivo */
  const itemsChanged = async (): Promise<void> => {
    if (!currentId) return
    await safeRun(() => window.sonora.live.loadService(currentId))
    await loadItems(currentId)
  }

  const onListChanged = async (selectId: string | null): Promise<void> => {
    await loadServices()
    setCurrentId(selectId)
  }

  const onDragEnd = async (e: DragEndEvent): Promise<void> => {
    if (!e.over || e.active.id === e.over.id) return
    const ids = items.map((r) => r.item.id)
    const to = ids.indexOf(String(e.over.id))
    const order = moveInArrangement(ids, ids.indexOf(String(e.active.id)), to)
    setItems(order.map((id) => items.find((r) => r.item.id === id)!))
    const r = await safeRun(() => window.sonora.services.moveItem(String(e.active.id), to))
    if (r.ok) await itemsChanged()
    else await loadItems(currentId)
  }

  const removeItem = async (id: string): Promise<void> => {
    const r = await safeRun(() => window.sonora.services.removeItem(id))
    if (r.ok) await itemsChanged()
  }

  const addNotice = async (data: NoticeData): Promise<boolean> => {
    if (!currentId) return false
    const d: ServiceItemData = { kind: 'notice', ...data }
    const r = await safeRun(() => window.sonora.services.addItem(currentId, d))
    if (!r.ok) return false
    await itemsChanged()
    return true
  }

  const editNotice = (id: string) => async (data: NoticeData): Promise<boolean> => {
    const d: ServiceItemData = { kind: 'notice', ...data }
    const r = await safeRun(() => window.sonora.services.updateItem(id, d))
    if (!r.ok) return false
    setEditingId(null)
    await itemsChanged()
    return true
  }

  const current = services.find((s) => s.id === currentId) ?? null
  const editing = items.find((r) => r.item.id === editingId)

  return (
    <section className="screen screen--split">
      <ServiceList services={services} currentId={currentId} onSelect={setCurrentId} onChanged={onListChanged} />
      <div className="detail-pane">
        <h1 className="screen__title">{strings.services.title}</h1>
        <ErrorBanner show={safe.error} />
        {!current ? (
          <p className="hint">{strings.services.pick}</p>
        ) : (
          <div className="form">
            <h2 className="pane-title">
              {strings.services.itemsTitle}: {current.name} ({formatDate(current.date)})
            </h2>
            {items.length === 0 ? (
              <p className="hint">{strings.services.itemsEmpty}</p>
            ) : (
              <>
                <p className="hint">{strings.services.itemsHelp}</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
                  <SortableContext items={items.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                    <ul className="service-items">
                      {items.map((r) => (
                        <ItemRow
                          key={r.item.id}
                          r={r}
                          onRemove={() => void removeItem(r.item.id)}
                          onEdit={r.item.data.kind === 'notice' ? () => setEditingId(r.item.id) : undefined}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              </>
            )}
            {editing && editing.item.data.kind === 'notice' ? (
              <div className="service-notice">
                <h3 className="pane-title">{strings.services.editNotice}</h3>
                <NoticeForm
                  key={editing.item.id}
                  initial={{
                    title: editing.item.data.title,
                    body: editing.item.data.body,
                    backgroundMediaId: editing.item.data.backgroundMediaId
                  }}
                  submitLabel={strings.services.saveNotice}
                  onSubmit={editNotice(editing.item.id)}
                />
                <button type="button" className="btn" onClick={() => setEditingId(null)}>
                  {strings.common.cancel}
                </button>
              </div>
            ) : (
              <div className="service-notice">
                <h3 className="pane-title">{strings.services.addNotice}</h3>
                <NoticeForm onSubmit={addNotice} submitLabel={strings.services.addNotice} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
