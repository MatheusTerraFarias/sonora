import { useCallback, useEffect, useRef, useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { ID } from '../../../shared/types'
import type { ServiceSound, SoundChannel, SoundMap } from '../../../shared/sound'
import { strings } from '../../shared/strings'
import { ChannelTable } from '../components/sound/ChannelTable'
import { Checklist } from '../components/sound/Checklist'
import { DevicePicker } from '../components/sound/DevicePicker'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
import { PanelHeader } from '../components/ui/PanelHeader'
import { useSafe } from '../components/useSafe'
import type { EngineState } from '../sound/meterEngine'
import { useMeters } from '../sound/useMeters'
import { useOperatorStore } from '../store'
import './Sound.css'

const S = strings.sound
const SAVE_DELAY_MS = 500
const NO_CHANNELS: SoundChannel[] = []

/** mapa escolhido sem culto: lembrado enquanto o app está aberto */
let lastFreeMapId: ID | null = null

const renumber = (list: SoundChannel[]): SoundChannel[] => list.map((c, i) => (c.number === i + 1 ? c : { ...c, number: i + 1 }))

type NameDialog = { mode: 'new' | 'duplicate' | 'rename'; name: string; error: string | null }

function EngineStatus({ state }: { state: EngineState }): JSX.Element {
  let tone: 'live' | 'wait' | 'alert'
  let text: string
  switch (state.kind) {
    case 'running':
      tone = 'live'
      text = S.engine.running(state.inputCount)
      break
    case 'error':
      tone = 'alert'
      text = S.engine[state.reason]
      break
    case 'starting':
      tone = 'wait'
      text = S.engine.starting
      break
    default:
      tone = 'wait'
      text = S.engine.idle
  }
  return (
    <span
      className={`sound-status sound-status--${tone}`}
      role="status"
      aria-label={S.statusLabel}
      title={state.kind === 'running' && state.deviceLabel ? state.deviceLabel : undefined}
    >
      {tone === 'alert' ? <Icon name="alert" size={16} /> : <span className="sound-status__dot" aria-hidden="true" />}
      <span className="tnum">{text}</span>
    </span>
  )
}

/**
 * Som: mapa de canais da mesa (editável no lugar) com medidores ao vivo e a passagem de som
 * do culto. Somente leitura em relação à mesa; a captura só roda com esta tela aberta.
 */
export function Sound(): JSX.Element {
  const serviceId = useOperatorStore((s) => s.currentServiceId)
  const [maps, setMaps] = useState<SoundMap[] | null>(null)
  const [svc, setSvc] = useState<ServiceSound | null>(null)
  const [freeMapId, setFreeMapId] = useState<ID | null>(lastFreeMapId)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<NameDialog | null>(null)
  const [focus, setFocus] = useState<ID | null>(null)
  const safe = useSafe()
  const safeRun = safe.run

  const mapsRef = useRef(maps)
  mapsRef.current = maps
  const pending = useRef(new Map<ID, SoundMap>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---------- gravação com atraso (500 ms depois da última edição) ----------
  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const list = [...pending.current.values()]
    pending.current.clear()
    for (const m of list) await safeRun(() => window.sonora.sound.save(m))
  }, [safeRun])

  const updateMap = useCallback(
    (id: ID, fn: (m: SoundMap) => SoundMap): void => {
      const list = mapsRef.current
      const cur = list?.find((m) => m.id === id)
      if (!list || !cur) return
      const next = fn(cur)
      const nextList = list.map((m) => (m.id === id ? next : m))
      mapsRef.current = nextList
      setMaps(nextList)
      pending.current.set(id, next)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush]
  )

  // grava o que faltar ao sair da tela
  useEffect(() => () => void flush(), [flush])

  // ---------- carga ----------
  const loadMaps = useCallback(async (): Promise<SoundMap[] | null> => {
    const r = await safeRun(() => window.sonora.sound.list())
    if (!r.ok) return null
    // edições ainda não gravadas continuam valendo
    const merged = r.value.map((m) => pending.current.get(m.id) ?? m)
    mapsRef.current = merged
    setMaps(merged)
    return merged
  }, [safeRun])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [, s] = await Promise.all([
        loadMaps(),
        serviceId ? safeRun(() => window.sonora.sound.getForService(serviceId)) : Promise.resolve(null)
      ])
      if (alive) setSvc(s && s.ok ? s.value : null)
    })()
    return () => {
      alive = false
    }
  }, [serviceId, loadMaps, safeRun])

  useEffect(() => {
    let alive = true
    window.sonora.settings
      .get()
      .then((s) => alive && setDeviceId(s.soundInputDeviceId))
      .catch(() => undefined)
    const off = window.sonora.settings.onChange((s) => setDeviceId(s.soundInputDeviceId))
    return () => {
      alive = false
      off()
    }
  }, [])

  // ---------- mapa atual ----------
  const freeId = maps && freeMapId && maps.some((m) => m.id === freeMapId) ? freeMapId : (maps?.[0]?.id ?? null)
  const svcReady = !serviceId || svc?.serviceId === serviceId
  const mapId = serviceId ? (svcReady ? (svc?.mapId ?? null) : null) : freeId
  const map = maps?.find((m) => m.id === mapId) ?? null
  const mapIdRef = useRef(mapId)
  mapIdRef.current = mapId

  const meters = useMeters(map?.channels ?? NO_CHANNELS)
  const { state } = meters

  const selectMap = async (id: ID | null): Promise<void> => {
    if (serviceId) {
      const r = await safeRun(() => window.sonora.sound.setForService(serviceId, { mapId: id }))
      if (r.ok) setSvc(r.value)
    } else {
      lastFreeMapId = id
      setFreeMapId(id)
    }
  }

  const saveDevice = async (id: string | null): Promise<void> => {
    setDeviceId(id)
    await safeRun(() => window.sonora.settings.update({ soundInputDeviceId: id }))
  }

  // ---------- canais ----------
  const editCurrent = useCallback(
    (fn: (m: SoundMap) => SoundMap) => {
      const id = mapIdRef.current
      if (id) updateMap(id, fn)
    },
    [updateMap]
  )

  const changeChannel = useCallback(
    (id: ID, patch: Partial<SoundChannel>) =>
      editCurrent((m) => ({ ...m, channels: m.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    [editCurrent]
  )
  const removeChannel = useCallback(
    (id: ID) => editCurrent((m) => ({ ...m, channels: renumber(m.channels.filter((c) => c.id !== id)) })),
    [editCurrent]
  )
  const moveChannel = useCallback(
    (from: number, to: number) => editCurrent((m) => ({ ...m, channels: renumber(arrayMove(m.channels, from, to)) })),
    [editCurrent]
  )
  const addChannel = (): void => {
    const id = crypto.randomUUID()
    editCurrent((m) => {
      const used = m.channels.map((c) => c.inputIndex ?? -1)
      const next: SoundChannel = {
        id,
        number: m.channels.length + 1,
        name: '',
        person: '',
        kind: 'wired',
        notes: '',
        inputIndex: Math.max(-1, ...used) + 1
      }
      return { ...m, channels: [...m.channels, next] }
    })
    setFocus(id)
  }

  // ---------- passagem de som ----------
  const toggleItem = async (itemId: ID, done: boolean): Promise<void> => {
    if (!serviceId || !svc) return
    const checked = done ? [...svc.checked.filter((x) => x !== itemId), itemId] : svc.checked.filter((x) => x !== itemId)
    setSvc({ ...svc, checked })
    const r = await safeRun(() => window.sonora.sound.setForService(serviceId, { checked }))
    if (r.ok) setSvc(r.value)
  }
  const addItem = (): void => {
    const id = crypto.randomUUID()
    editCurrent((m) => ({ ...m, checklist: [...m.checklist, { id, text: '' }] }))
    setFocus(id)
  }
  const editItem = (id: ID, text: string): void =>
    editCurrent((m) => ({ ...m, checklist: m.checklist.map((c) => (c.id === id ? { ...c, text } : c)) }))
  const removeItem = (id: ID): void => editCurrent((m) => ({ ...m, checklist: m.checklist.filter((c) => c.id !== id) }))

  // ---------- mapas: novo, duplicar, renomear, apagar ----------
  const openDialog = (mode: NameDialog['mode']): void => {
    const name = mode === 'new' ? (maps && maps.length > 0 ? '' : S.defaultMapName) : mode === 'duplicate' ? S.copyName(map?.name ?? '') : (map?.name ?? '')
    setDialog({ mode, name, error: null })
  }

  const submitDialog = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!dialog) return
    const name = dialog.name.trim()
    if (!name) {
      setDialog({ ...dialog, error: S.mapNameRequired })
      return
    }
    if (dialog.mode === 'rename') {
      if (map) updateMap(map.id, (m) => ({ ...m, name }))
      setDialog(null)
      return
    }
    await flush()
    const source = map
    const r =
      dialog.mode === 'duplicate' && source
        ? await safeRun(() => window.sonora.sound.duplicate(source.id, name))
        : await safeRun(() => window.sonora.sound.create(name))
    if (!r.ok) return
    setDialog(null)
    await loadMaps()
    await selectMap(r.value.id)
  }

  const deleteMap = async (): Promise<void> => {
    if (!map || !window.confirm(S.confirmDeleteMap)) return
    pending.current.delete(map.id)
    const r = await safeRun(() => window.sonora.sound.remove(map.id))
    if (!r.ok) return
    await loadMaps()
    if (serviceId) {
      const s = await safeRun(() => window.sonora.sound.getForService(serviceId))
      if (s.ok) setSvc(s.value)
    }
  }

  // ---------- tela ----------
  const loading = maps === null || !svcReady
  const hasMaps = !!maps && maps.length > 0
  const engineError = state.kind === 'error' ? state.reason : null

  const mapPicker = hasMaps && (
    <label className="sound-picker">
      <span className="sound-picker__label">{S.map}</span>
      <select className="input sound-picker__select" aria-label={S.mapLabel} value={mapId ?? ''} onChange={(e) => void selectMap(e.target.value || null)}>
        {(serviceId || !mapId) && <option value="">{S.noMap}</option>}
        {maps.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  )

  let body: React.ReactNode
  if (loading) body = <p className="hint sound__pad">{strings.common.loading}</p>
  else if (!hasMaps)
    body = (
      <div className="sound__pad">
        <EmptyState
          icon="sliders"
          title={S.emptyTitle}
          text={S.emptyText}
          action={
            <Button variant="primary" icon="plus" onClick={() => openDialog('new')}>
              {S.newMap}
            </Button>
          }
        />
      </div>
    )
  else if (!map)
    body = (
      <div className="sound__pad">
        <EmptyState
          icon="sliders"
          title={S.noMapTitle}
          text={S.noMapText}
          action={
            <Button icon="plus" onClick={() => openDialog('new')}>
              {S.newMap}
            </Button>
          }
        />
      </div>
    )
  else
    body = (
      <>
        <div className="sound__scroll">
          {map.channels.length === 0 ? (
            <div className="sound__pad">
              <EmptyState
                compact
                icon="mic"
                title={S.noChannelsTitle}
                text={S.noChannelsText}
                action={
                  <Button variant="primary" icon="plus" aria-label={S.addChannelLabel} onClick={addChannel}>
                    {S.addChannel}
                  </Button>
                }
              />
            </div>
          ) : (
            <ChannelTable
              channels={map.channels}
              inputCount={state.kind === 'running' ? state.inputCount : null}
              focusId={focus}
              subscribe={meters.subscribe}
              onChange={changeChannel}
              onRemove={removeChannel}
              onMove={moveChannel}
            />
          )}
        </div>
        <footer className="sound__foot">
          <Checklist
            items={map.checklist}
            checked={serviceId ? (svc?.checked ?? []) : null}
            focusId={focus}
            onToggle={(id, done) => void toggleItem(id, done)}
            onEdit={editItem}
            onAdd={addItem}
            onRemove={removeItem}
            actions={
              <>
                <Button variant="primary" icon="plus" aria-label={S.addChannelLabel} onClick={addChannel}>
                  {S.addChannel}
                </Button>
                <Button icon="copy" onClick={() => openDialog('duplicate')}>
                  {S.duplicateMap}
                </Button>
                <Button icon="plus" onClick={() => openDialog('new')}>
                  {S.newMap}
                </Button>
                <span className="sound__actions-sep" aria-hidden="true" />
                <Button variant="ghost" icon="pencil" iconOnly onClick={() => openDialog('rename')}>
                  {S.renameMap}
                </Button>
                <Button variant="danger" icon="trash" iconOnly onClick={() => void deleteMap()}>
                  {S.deleteMap}
                </Button>
              </>
            }
          />
        </footer>
      </>
    )

  return (
    <section className="workspace sound">
      <PanelHeader
        level={1}
        title={S.title}
        meta={S.readOnly}
        actions={
          <>
            {mapPicker}
            <DevicePicker value={deviceId} refreshKey={state.kind} onChange={(id) => void saveDevice(id)} />
            <EngineStatus state={state} />
          </>
        }
      />
      {(engineError || safe.error) && (
        <div className="sound__alerts">
          {engineError && (
            <div className="sound-banner" role="alert">
              <Icon name="alert" size={18} />
              <p className="sound-banner__text">
                <strong>{S.engine[engineError]}.</strong> {S.engineAction[engineError]}
              </p>
              {engineError !== 'disconnected' && (
                <Button size="sm" icon="restore" onClick={meters.retry}>
                  {S.retry}
                </Button>
              )}
            </div>
          )}
          {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
        </div>
      )}
      <div className="sound__body">{body}</div>

      <Dialog
        open={!!dialog}
        title={dialog?.mode === 'duplicate' ? S.duplicateMap : dialog?.mode === 'rename' ? S.renameMap : S.newMap}
        description={dialog?.mode === 'duplicate' ? S.duplicateMapDescription : dialog?.mode === 'new' ? S.newMapDescription : undefined}
        onClose={() => setDialog(null)}
      >
        {dialog && (
          <form className="dialog-form" onSubmit={(e) => void submitDialog(e)}>
            <Field label={S.mapName} error={dialog.error}>
              <input className="input" value={dialog.name} autoFocus onChange={(e) => setDialog({ ...dialog, name: e.target.value, error: null })} />
            </Field>
            <div className="dialog-form__actions">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                {strings.common.cancel}
              </Button>
              <Button type="submit" variant="primary">
                {dialog.mode === 'rename' ? strings.common.save : dialog.mode === 'duplicate' ? S.duplicateMap : S.create}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </section>
  )
}
