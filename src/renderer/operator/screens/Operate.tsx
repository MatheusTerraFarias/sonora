import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ID, LiveProgress, LiveState, MediaItem, Overlay, ResolvedItem, Slide, SongAttachment } from '../../../shared/types'
import type { DisplayInfo } from '../../../shared/displays'
import { pickProjectionDisplay } from '../../../shared/displays'
import { nextPosition } from '../../../shared/navigation'
import { strings } from '../../shared/strings'
import { EmergencyBar } from '../components/EmergencyBar'
import { MediaControls } from '../components/MediaControls'
import { PreviewPanel, type NextPreview } from '../components/PreviewPanel'
import { SlideGrid } from '../components/SlideGrid'
import { ErrorBanner, useSafe } from '../components/useSafe'
import { useOperatorStore } from '../store'
import type { ShortcutAction } from '../shortcuts'
import { useShortcuts } from '../useShortcuts'
import '../components/Operate.css'

interface OutlineEntry {
  itemId: ID
  skip: boolean
  slides: Slide[]
}

/** Operação ao vivo: ordem do culto, grade de slides, prévia/ao vivo e botões de emergência. */
export function Operate(): JSX.Element {
  const serviceId = useOperatorStore((s) => s.currentServiceId)
  const online = useOperatorStore((s) => s.onlineStatus)
  const [progress, setProgress] = useState<LiveProgress | null>(null)
  const [items, setItems] = useState<ResolvedItem[]>([])
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  const [attachments, setAttachments] = useState<Record<ID, SongAttachment>>({})
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [live, setLive] = useState<LiveState | null>(null)
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [savedDisplayId, setSavedDisplayId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<ID | null>(null)
  const [attachmentError, setAttachmentError] = useState(false)
  const safe = useSafe()
  const run = safe.run
  const seq = useRef(0)

  // estado ao vivo, monitores e configurações (assinaturas)
  useEffect(() => {
    void run(() => window.sonora.live.get()).then((r) => r.ok && setLive((cur) => cur ?? r.value))
    const offLive = window.sonora.live.onState(setLive)
    void run(() => window.sonora.displays.list()).then((r) => r.ok && setDisplays(r.value))
    const offDisplays = window.sonora.displays.onChange(setDisplays)
    void run(() => window.sonora.settings.get()).then((r) => r.ok && setSavedDisplayId(r.value.projectionDisplayId))
    const offSettings = window.sonora.settings.onChange((s) => setSavedDisplayId(s.projectionDisplayId))
    const offProgress = window.sonora.live.onProgress(setProgress)
    void run(() => window.sonora.media.list()).then((r) => r.ok && setLibrary(r.value))
    return () => {
      offLive()
      offDisplays()
      offSettings()
      offProgress()
    }
  }, [run])

  /** (re)carrega o culto no controle ao vivo e busca itens, slides e anexos das músicas */
  const refresh = useCallback(
    async (id: ID | null): Promise<void> => {
      const mine = ++seq.current
      if (!id) {
        setItems([])
        setOutline([])
        return
      }
      const loaded = await run(async () => {
        await window.sonora.live.loadService(id)
        const [resolved, out] = await Promise.all([window.sonora.services.resolve(id), window.sonora.live.outline()])
        const songIds = [...new Set(resolved.flatMap((r) => (r.item.data.kind === 'song' && !r.missing ? [r.item.data.songId] : [])))]
        const songs = await Promise.all(songIds.map((sid) => window.sonora.songs.get(sid)))
        const att: Record<ID, SongAttachment> = {}
        songs.forEach((s) => {
          if (s) att[s.id] = s.attachment
        })
        return { resolved, out, att }
      })
      if (mine !== seq.current || !loaded.ok) return
      setItems(loaded.value.resolved)
      setOutline(loaded.value.out)
      setAttachments(loaded.value.att)
    },
    [run]
  )

  useEffect(() => {
    setSelectedId(null)
    void refresh(serviceId)
  }, [serviceId, refresh])

  // conexão mudou: o main já recalculou os `skip` (watchOnlineStatus); recarrega a ordem
  const serviceRef = useRef(serviceId)
  serviceRef.current = serviceId
  const firstOnline = useRef(true)
  useEffect(() => {
    if (firstOnline.current) {
      firstOnline.current = false
      return
    }
    void refresh(serviceRef.current)
  }, [online, refresh])

  // a seleção acompanha o item que vai ao ar; sem seleção, o primeiro item
  const cursorId = live?.cursor.itemId ?? null
  useEffect(() => {
    if (cursorId) setSelectedId(cursorId)
  }, [cursorId])
  const selected = items.find((r) => r.item.id === selectedId) ?? items[0] ?? null
  const selectedOutline = selected ? outline.find((o) => o.itemId === selected.item.id) : undefined

  const overlayOf = (o: Overlay): void => void run(() => window.sonora.live.setOverlay(o))
  const onShortcut = useCallback(
    (a: ShortcutAction): void => {
      if (a === 'next') void run(() => window.sonora.live.next())
      else if (a === 'prev') void run(() => window.sonora.live.prev())
      else void run(() => window.sonora.live.setOverlay(a))
    },
    [run]
  )
  useShortcuts(onShortcut)

  const goTo = (itemId: ID, slide: number): void => void run(() => window.sonora.live.goTo(itemId, slide))

  /** atalho do anexo: insere o vídeo logo após a música, recarrega o culto e vai a ele */
  const projectAttachment = async (r: ResolvedItem, att: NonNullable<SongAttachment>): Promise<void> => {
    if (!serviceId) return
    setAttachmentError(false)
    const data =
      att.kind === 'youtube'
        ? ({
            kind: 'youtube',
            videoId: att.videoId,
            title: att.title,
            thumbnail: `https://i.ytimg.com/vi/${att.videoId}/hqdefault.jpg`
          } as const)
        : ({ kind: 'media', mediaId: att.mediaId } as const)
    const added = await run(() => window.sonora.services.addItem(serviceId, data, r.item.position + 1))
    if (!added.ok) {
      setAttachmentError(true)
      return
    }
    // o item já está salvo: a lista é sempre recarregada, mesmo que o resto falhe
    const itemId = added.value.id
    const reloaded = await run(() => window.sonora.live.loadService(serviceId))
    await refresh(serviceId)
    setSelectedId(itemId)
    if (!reloaded.ok) return
    await run(() => window.sonora.live.goTo(itemId, 0))
  }

  const projection = useMemo(() => {
    const id = pickProjectionDisplay(displays, savedDisplayId, displays.find((d) => d.isOperator)?.id ?? -1)
    return id === null ? null : (displays.find((d) => d.id === id)?.label ?? null)
  }, [displays, savedDisplayId])

  const next = useMemo((): NextPreview => {
    const nav = outline.map((o) => ({ slideCount: o.slides.length, skip: o.skip }))
    const at = cursorId ? outline.findIndex((o) => o.itemId === cursorId) : -1
    let pos
    if (at < 0) {
      const first = nav.findIndex((n) => !n.skip)
      pos = first < 0 ? null : { item: first, slide: 0 }
    } else {
      pos = nextPosition(nav, { item: at, slide: live?.cursor.slideIndex ?? 0 })
    }
    if (!pos) return { kind: 'end' }
    const entry = outline[pos.item]
    const slide = entry.slides[pos.slide]
    if (slide) return { kind: 'slide', slide }
    const r = items.find((i) => i.item.id === entry.itemId)
    const d = r?.item.data
    return {
      kind: 'media',
      media: d?.kind === 'media' ? (library.find((m) => m.id === d.mediaId) ?? null) : null,
      title: r?.title ?? ''
    }
  }, [outline, items, library, cursorId, live])

  const liveContent = live?.content
  const selectedIsLive = !!selected && cursorId === selected.item.id
  const selData = selected?.item.data
  const isMediaItem = selData?.kind === 'media' || selData?.kind === 'youtube'
  const mediaLive =
    selectedIsLive && (liveContent?.type === 'media' || liveContent?.type === 'youtube') ? liveContent : null
  const liveKey =
    liveContent?.type === 'media' ? liveContent.media.id : liveContent?.type === 'youtube' ? liveContent.videoId : null
  const liveProgress = progress && progress.key === liveKey ? progress : null
  const selectedOffline = selData?.kind === 'youtube' && !online

  if (!serviceId) {
    return (
      <section className="screen">
        <h1 className="screen__title">{strings.operation.title}</h1>
        <p className="hint">{strings.operation.noService}</p>
      </section>
    )
  }

  return (
    <section className="operate">
      <div className="operate__header">
        <h1 className="screen__title">{strings.operation.title}</h1>
        <ErrorBanner show={safe.error} />
        {!online && <p className="hint">{strings.operation.offlineHint}</p>}
        {attachmentError && (
          <p className="hint hint--error" role="alert">
            {strings.operation.attachmentFailed}
          </p>
        )}
      </div>
      <div className="operate__body">
        <div className="operate__col">
          <h2 className="pane-title">{strings.operation.order}</h2>
          {items.length === 0 && <p className="hint">{strings.operation.emptyService}</p>}
          <ul className="list">
            {items.map((r) => {
              const att = r.item.data.kind === 'song' && !r.missing ? attachments[r.item.data.songId] : null
              const classes = ['order-item']
              if (r.missing) classes.push('order-item--missing')
              if (r.item.id === cursorId) classes.push('order-item--live')
              const offline = r.item.data.kind === 'youtube' && !online
              if (offline) classes.push('order-item--offline')
              return (
                <li key={r.item.id} className={classes.join(' ')}>
                  <button
                    type="button"
                    className={r.item.id === selected?.item.id ? 'list__item list__item--active' : 'list__item'}
                    onClick={() => setSelectedId(r.item.id)}
                  >
                    <span className="order-item__kind">{strings.services.kind[r.item.data.kind]}</span>
                    <span className="order-item__title">{r.missing ? strings.operation.removedItem : r.title}</span>
                    {offline && <span className="order-item__badge">{strings.operation.offline}</span>}
                  </button>
                  {att && (
                    <button type="button" className="btn" onClick={() => void projectAttachment(r, att)}>
                      {strings.operation.attachment}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="operate__col">
          <h2 className="pane-title">
            {selected && !selected.missing ? `${selected.title} · ${strings.operation.slides}` : strings.operation.slides}
          </h2>
          {!selected && <p className="hint">{strings.operation.pickItem}</p>}
          {selected?.missing && <p className="hint">{strings.operation.removedItem}</p>}
          {selected && !selected.missing && !isMediaItem && selectedOutline && (
            <SlideGrid
              slides={selectedOutline.slides}
              liveIndex={selectedIsLive ? (live?.cursor.slideIndex ?? -1) : -1}
              onPick={(i) => goTo(selected.item.id, i)}
            />
          )}
          {selected && !selected.missing && isMediaItem && (
            <>
              <div>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={selectedOffline}
                  onClick={() => goTo(selected.item.id, 0)}
                >
                  {strings.operation.project}
                </button>
                {selectedOffline && <p className="hint">{strings.operation.offline}</p>}
              </div>
              <MediaControls
                playing={mediaLive?.playing ?? false}
                volume={mediaLive?.volume ?? 1}
                position={liveProgress?.position ?? mediaLive?.position ?? 0}
                duration={mediaLive ? liveProgress?.duration : undefined}
                disabled={!mediaLive}
                onCommand={(cmd) => void run(() => window.sonora.live.media(cmd))}
              />
            </>
          )}
        </div>

        {live && <PreviewPanel live={live} next={next} progress={liveProgress} />}
      </div>
      <EmergencyBar overlay={live?.overlay ?? 'none'} monitorLabel={projection} onOverlay={overlayOf} />
    </section>
  )
}
