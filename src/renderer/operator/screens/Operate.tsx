import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ID, LiveProgress, LiveState, MediaItem, Overlay, ResolvedItem, Slide, SongAttachment } from '../../../shared/types'
import { nextFromCursor } from '../../../shared/navigation'
import { strings } from '../../shared/strings'
import { EmergencyBar } from '../components/operate/EmergencyBar'
import { MediaControls } from '../components/operate/MediaControls'
import { NextMonitor, ProgramMonitor, type NextPreview } from '../components/operate/Monitors'
import { RunOfShow, kindIcon } from '../components/operate/RunOfShow'
import { SlideTiles } from '../components/operate/SlideTiles'
import { Button } from '../components/ui/Button'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { MediaCard } from '../components/ui/Monitor'
import { PanelHeader } from '../components/ui/PanelHeader'
import { SlideCanvas } from '../components/ui/SlideCanvas'
import { mediaUrl } from '../components/MediaThumb'
import { useSafe } from '../components/useSafe'
import { useOperatorStore } from '../store'
import type { ShortcutAction } from '../shortcuts'
import { useShortcuts } from '../useShortcuts'
import './Operate.css'

interface OutlineEntry {
  itemId: ID
  skip: boolean
  slides: Slide[]
}

/** Operação ao vivo: ordem do culto, slides do item, monitores Próximo/No telão e teclas de emergência. */
export function Operate(): JSX.Element {
  const serviceId = useOperatorStore((s) => s.currentServiceId)
  const online = useOperatorStore((s) => s.onlineStatus)
  const setSection = useOperatorStore((s) => s.setSection)
  const [progress, setProgress] = useState<LiveProgress | null>(null)
  const [items, setItems] = useState<ResolvedItem[]>([])
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  const [attachments, setAttachments] = useState<Record<ID, SongAttachment>>({})
  const [library, setLibrary] = useState<MediaItem[]>([])
  const [live, setLive] = useState<LiveState | null>(null)
  const [selectedId, setSelectedId] = useState<ID | null>(null)
  const [attachmentError, setAttachmentError] = useState(false)
  const safe = useSafe()
  const run = safe.run
  const seq = useRef(0)

  // estado ao vivo, progresso e biblioteca (assinaturas)
  useEffect(() => {
    void run(() => window.sonora.live.get()).then((r) => r.ok && setLive((cur) => cur ?? r.value))
    const offLive = window.sonora.live.onState(setLive)
    const offProgress = window.sonora.live.onProgress(setProgress)
    void run(() => window.sonora.media.list()).then((r) => r.ok && setLibrary(r.value))
    return () => {
      offLive()
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

  // próxima posição (mesma regra do main): alimenta o monitor "Próximo" e a moldura Âmbar
  const cue = useMemo((): { next: NextPreview; itemId: ID | null; slide: number } => {
    const nav = outline.map((o) => ({ slideCount: o.slides.length, skip: o.skip }))
    const at = cursorId ? outline.findIndex((o) => o.itemId === cursorId) : -1
    // sem item ao vivo, continua da lacuna deixada por um item removido
    const pos = nextFromCursor(nav, at, live?.cursor.slideIndex ?? 0, live?.cursor.gap ?? null)
    if (!pos) return { next: { kind: 'end' }, itemId: null, slide: -1 }
    const entry = outline[pos.item]
    const slide = entry.slides[pos.slide]
    if (slide) return { next: { kind: 'slide', slide }, itemId: entry.itemId, slide: pos.slide }
    const r = items.find((i) => i.item.id === entry.itemId)
    const d = r?.item.data
    return {
      next: {
        kind: 'media',
        media: d?.kind === 'media' ? (library.find((m) => m.id === d.mediaId) ?? null) : null,
        title: r?.title ?? '',
        thumbnail: d?.kind === 'youtube' ? d.thumbnail : null
      },
      itemId: entry.itemId,
      slide: pos.slide
    }
  }, [outline, items, library, cursorId, live])

  const slideCounts = useMemo(() => Object.fromEntries(outline.map((o) => [o.itemId, o.slides.length])), [outline])

  const liveContent = live?.content
  const selectedIsLive = !!selected && cursorId === selected.item.id
  const selData = selected?.item.data
  const isMediaItem = selData?.kind === 'media' || selData?.kind === 'youtube'
  const mediaLive = liveContent?.type === 'media' || liveContent?.type === 'youtube' ? liveContent : null
  const liveKey =
    liveContent?.type === 'media' ? liveContent.media.id : liveContent?.type === 'youtube' ? liveContent.videoId : null
  const liveProgress = progress && progress.key === liveKey ? progress : null
  const selectedOffline = selData?.kind === 'youtube' && !online
  const liveTitle = items.find((r) => r.item.id === cursorId)?.title ?? null

  const selectedMedia = selData?.kind === 'media' ? (library.find((m) => m.id === selData.mediaId) ?? null) : null

  const center = ((): JSX.Element => {
    if (!serviceId) {
      return (
        <div className="operate__center-empty">
          <EmptyState
            icon="services"
            title={strings.operation.noServiceTitle}
            text={strings.operation.noServiceHint}
            action={
              <Button variant="primary" onClick={() => setSection('services')}>
                {strings.shell.pickService}
              </Button>
            }
          />
        </div>
      )
    }
    if (!selected) {
      return (
        <div className="operate__center-empty">
          <EmptyState icon="services" title={strings.operation.emptyService} text={strings.operation.pickItem} />
        </div>
      )
    }
    const header = (
      <PanelHeader
        title={selected.missing ? strings.operation.removedItem : selected.title}
        meta={
          selected.missing
            ? undefined
            : `${strings.services.kind[selected.item.data.kind]}${selectedOutline && selectedOutline.slides.length > 0 ? ` · ${strings.songs.slideCount(selectedOutline.slides.length)}` : ''}`
        }
      />
    )
    if (selected.missing) {
      return (
        <>
          {header}
          <div className="operate__scroll">
            <EmptyState icon="alert" title={strings.operation.removedItem} compact />
          </div>
        </>
      )
    }
    if (isMediaItem) {
      return (
        <>
          {header}
          <div className="operate__scroll">
            <div className="operate__media">
              <button
                type="button"
                className={selectedIsLive ? 'tile tile--live tile--wide' : 'tile tile--wide'}
                disabled={selectedOffline}
                onClick={() => goTo(selected.item.id, 0)}
                aria-label={`${strings.operation.project}: ${selected.title}`}
              >
                <span className="tile__screen">
                  {live && (
                    <SlideCanvas background={live.background} style={live.style} bare>
                      {selectedMedia?.kind === 'image' ? (
                        <img className="stage-image" src={mediaUrl(selectedMedia.id)} alt="" draggable={false} />
                      ) : (
                        <MediaCard
                          icon={kindIcon(selected.item.data, library)}
                          title={selected.title}
                          thumb={selData?.kind === 'youtube' ? selData.thumbnail : null}
                        />
                      )}
                    </SlideCanvas>
                  )}
                  {selectedIsLive && <span className="tile__tag tile__tag--live">{strings.operation.liveTag}</span>}
                </span>
              </button>
              <div className="inline-actions">
                <Button variant="primary" size="lg" icon="play" disabled={selectedOffline} onClick={() => goTo(selected.item.id, 0)}>
                  {strings.operation.project}
                </Button>
                {selectedOffline ? (
                  <Notice tone="warn">{strings.operation.offline}</Notice>
                ) : (
                  <span className="hint">{strings.operation.mediaItemHint}</span>
                )}
              </div>
            </div>
          </div>
        </>
      )
    }
    return (
      <>
        {header}
        <div className="operate__scroll">
          {!selectedOutline || selectedOutline.slides.length === 0 ? (
            <EmptyState icon="alert" title={strings.operation.noSlides} compact />
          ) : (
            live && (
              <SlideTiles
                slides={selectedOutline.slides}
                liveIndex={selectedIsLive ? (live.cursor.slideIndex ?? -1) : -1}
                cueIndex={cue.itemId === selected.item.id ? cue.slide : -1}
                background={live.background}
                style={live.style}
                onPick={(i) => goTo(selected.item.id, i)}
              />
            )
          )}
        </div>
      </>
    )
  })()

  return (
    <section className="operate" aria-label={strings.operation.title}>
      <h1 className="visually-hidden">{strings.operation.title}</h1>
      <div className="operate__body">
        <aside className="operate__order">
          <PanelHeader title={strings.operation.order} meta={serviceId ? strings.services.itemCount(items.length) : undefined} />
          <div className="operate__scroll operate__scroll--order">
            {serviceId && items.length === 0 && <EmptyState icon="services" title={strings.operation.emptyService} compact />}
            <RunOfShow
              items={items}
              slideCounts={slideCounts}
              library={library}
              selectedId={selected?.item.id ?? null}
              liveId={cursorId}
              cueId={cue.itemId}
              online={online}
              attachments={attachments}
              onSelect={setSelectedId}
              onAttachment={(r, att) => void projectAttachment(r, att)}
            />
          </div>
        </aside>

        <div className="operate__center">
          {(safe.error || attachmentError || (!online && !!serviceId)) && (
            <div className="operate__alerts">
              {safe.error && <Notice tone="error">{strings.common.error}</Notice>}
              {attachmentError && <Notice tone="error">{strings.operation.attachmentFailed}</Notice>}
              {!online && serviceId && <Notice tone="warn">{strings.operation.offlineHint}</Notice>}
            </div>
          )}
          {center}
        </div>

        <aside className="operate__monitors">
          {live && (
            <>
              <NextMonitor live={live} next={cue.next} itemTitle={items.find((r) => r.item.id === cue.itemId)?.title ?? null} />
              <ProgramMonitor live={live} progress={liveProgress} liveTitle={liveTitle}>
                {mediaLive && (
                  <MediaControls
                    playing={mediaLive.playing}
                    volume={mediaLive.volume}
                    position={liveProgress?.position ?? mediaLive.position}
                    duration={liveProgress?.duration}
                    onCommand={(cmd) => void run(() => window.sonora.live.media(cmd))}
                  />
                )}
              </ProgramMonitor>
            </>
          )}
        </aside>
      </div>
      <EmergencyBar overlay={live?.overlay ?? 'none'} onOverlay={overlayOf} />
    </section>
  )
}
