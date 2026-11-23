import { useCallback, useEffect, useRef, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { MediaItem, ResolvedItem, ServiceItemData } from '../../../shared/types'
import { moveInArrangement } from '../../../shared/arrangement'
import { strings } from '../../shared/strings'
import { NoticeForm, type NoticeData } from '../components/NoticeForm'
import { kindIcon } from '../components/operate/RunOfShow'
import { ServiceList, type ServiceSummary } from '../components/ServiceList'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { PanelHeader } from '../components/ui/PanelHeader'
import { useSafe } from '../components/useSafe'
import { formatDate, todayIso, weekday } from '../format'
import { useLiveState } from '../hooks'
import { useOperatorStore } from '../store'
import './Services.css'

function ItemRow({
  r,
  index,
  library,
  live,
  onRemove,
  onEdit
}: {
  r: ResolvedItem
  index: number
  library: MediaItem[]
  live: boolean
  onRemove: () => void
  onEdit?: () => void
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.item.id })
  const kind = strings.services.kind[r.item.data.kind]
  const cls = ['script-item']
  if (r.missing) cls.push('script-item--missing')
  if (isDragging) cls.push('script-item--dragging')
  if (live) cls.push('script-item--live')
  return (
    <li
      ref={setNodeRef}
      className={cls.join(' ')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      title={strings.services.dragItem}
    >
      <span className="script-item__grip" aria-hidden="true">
        <Icon name="grip" size={16} />
      </span>
      <span className="script-item__num tnum">{String(index + 1).padStart(2, '0')}</span>
      <span className="script-item__icon">
        <Icon name={kindIcon(r.item.data, library)} size={16} />
      </span>
      <span className="script-item__text">
        <span className="script-item__title">{r.missing ? strings.services.removedItem : r.title}</span>
        <span className="script-item__kind">{kind}</span>
      </span>
      {live && (
        <span className="script-item__live">
          <span className="visually-hidden">{strings.operation.liveTag}</span>
        </span>
      )}
      <span className="script-item__actions">
        {onEdit && !r.missing && (
          <Button variant="ghost" icon="pencil" iconOnly onPointerDown={(e) => e.stopPropagation()} onClick={onEdit}>
            {strings.services.editNotice}
          </Button>
        )}
        <Button
          variant="danger"
          icon="trash"
          iconOnly
          aria-label={`${strings.services.removeItem}: ${r.title}`}
          title={strings.services.removeItem}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
        >
          {strings.common.remove}
        </Button>
      </span>
    </li>
  )
}

/** Cultos: lista por data, roteiro do culto escolhido (arrastar para ordenar) e diálogos de culto/aviso. */
export function Services(): JSX.Element {
  const currentId = useOperatorStore((s) => s.currentServiceId)
  const setCurrentId = useOperatorStore((s) => s.setCurrentServiceId)
  const setSection = useOperatorStore((s) => s.setSection)
  const bumpServices = useOperatorStore((s) => s.bumpServices)
  const [services, setServices] = useState<ServiceSummary[]>([])
  const [items, setItems] = useState<ResolvedItem[]>([])
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNotice, setAddingNotice] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [dupDate, setDupDate] = useState(todayIso())
  const safe = useSafe()
  const safeRun = safe.run
  const seq = useRef(0)
  const live = useLiveState()
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
    void safeRun(() => window.sonora.media.list()).then((r) => r.ok && setLibrary(r.value))
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
    bumpServices()
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
    setAddingNotice(false)
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

  const duplicate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!currentId || !dupDate) return
    const r = await safeRun(() => window.sonora.services.duplicate(currentId, dupDate))
    if (!r.ok) return
    setDuplicating(false)
    await onListChanged(r.value.id)
  }

  const remove = async (): Promise<void> => {
    if (!currentId || !window.confirm(strings.services.confirmDelete)) return
    const r = await safeRun(() => window.sonora.services.remove(currentId))
    if (r.ok) await onListChanged(null)
  }

  const current = services.find((s) => s.id === currentId) ?? null
  const liveId = live?.cursor.itemId ?? null
  const editing = items.find((r) => r.item.id === editingId)

  return (
    <section className="split services">
      <ServiceList services={services} currentId={currentId} onSelect={setCurrentId} onChanged={onListChanged} />
      <div className="split__detail">
        {!current ? (
          <div className="detail__empty">
            <EmptyState icon="services" title={strings.services.pickTitle} text={strings.services.pick} />
            {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
          </div>
        ) : (
          <>
            <PanelHeader
              title={current.name}
              meta={`${formatDate(current.date)} · ${weekday(current.date)} · ${strings.services.itemCount(items.length)}`}
              actions={
                <>
                  <Button variant="danger" icon="trash" iconOnly onClick={remove}>
                    {strings.services.delete}
                  </Button>
                  <Button
                    variant="ghost"
                    icon="copy"
                    iconOnly
                    onClick={() => {
                      setDupDate(todayIso())
                      setDuplicating(true)
                    }}
                  >
                    {strings.services.duplicate}
                  </Button>
                  <Button icon="megaphone" onClick={() => setAddingNotice(true)}>
                    {strings.services.addNotice}
                  </Button>
                  <Button variant="primary" icon="operation" onClick={() => setSection('operation')}>
                    {strings.services.operate}
                  </Button>
                </>
              }
            />
            <div className="detail__scroll">
              <div className="detail__body services__body">
                {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
                {items.length === 0 ? (
                  <EmptyState icon="listPlus" title={strings.services.itemsEmptyTitle} text={strings.services.itemsEmpty} />
                ) : (
                  <div>
                    <div className="services__script-head">
                      <h2 className="section-title">{strings.services.itemsTitle}</h2>
                      <span className="hint">{strings.services.itemsHelp}</span>
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
                      <SortableContext items={items.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
                        <ol className="script">
                          {items.map((r, i) => (
                            <ItemRow
                              key={r.item.id}
                              r={r}
                              index={i}
                              library={library}
                              live={r.item.id === liveId}
                              onRemove={() => void removeItem(r.item.id)}
                              onEdit={r.item.data.kind === 'notice' ? () => setEditingId(r.item.id) : undefined}
                            />
                          ))}
                        </ol>
                      </SortableContext>
                    </DndContext>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog
        open={addingNotice && !!current}
        title={strings.services.addNotice}
        description={strings.services.noticeDescription}
        onClose={() => setAddingNotice(false)}
      >
        <NoticeForm onSubmit={addNotice} submitLabel={strings.services.addNotice} onCancel={() => setAddingNotice(false)} autoFocus />
      </Dialog>

      <Dialog open={!!editing && editing.item.data.kind === 'notice'} title={strings.services.editNotice} onClose={() => setEditingId(null)}>
        {editing && editing.item.data.kind === 'notice' && (
          <NoticeForm
            key={editing.item.id}
            initial={{
              title: editing.item.data.title,
              body: editing.item.data.body,
              backgroundMediaId: editing.item.data.backgroundMediaId
            }}
            submitLabel={strings.services.saveNotice}
            onSubmit={editNotice(editing.item.id)}
            onCancel={() => setEditingId(null)}
            autoFocus
          />
        )}
      </Dialog>

      <Dialog
        open={duplicating && !!current}
        title={strings.services.duplicateTitle}
        description={strings.services.duplicateDescription}
        onClose={() => setDuplicating(false)}
      >
        <form className="dialog-form" onSubmit={duplicate}>
          <Field label={strings.services.duplicateDate}>
            <input className="input" type="date" value={dupDate} autoFocus onChange={(e) => setDupDate(e.target.value)} />
          </Field>
          <div className="dialog-form__actions">
            <Button variant="ghost" onClick={() => setDuplicating(false)}>
              {strings.common.cancel}
            </Button>
            <Button type="submit" variant="primary" icon="copy">
              {strings.services.duplicate}
            </Button>
          </div>
        </form>
      </Dialog>
    </section>
  )
}
