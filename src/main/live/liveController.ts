import type { ID, LiveContent, LiveState, MediaItem, Overlay, ResolvedItem, Service, Settings, Slide } from '../../shared/types'
import { buildSlides, type SlideDeps } from '../../shared/slides'
import { nextFromCursor, prevFromCursor } from '../../shared/navigation'
import { resolveItem, type ResolveDeps } from '../repos/services'

export interface LiveDeps extends SlideDeps {
  services: { get(id: ID): Service | null }
  resolveDeps: ResolveDeps
  media: { get(id: ID): MediaItem | null }
  settings: { get(): Settings; onChange(cb: (s: Settings) => void): () => void }
  send(state: LiveState): void
}

interface Entry {
  resolved: ResolvedItem
  slides: Slide[]
  skip: boolean
}

export class LiveController {
  private state: LiveState
  private entries: Entry[] = []
  private serviceId: ID | null = null
  private online = true
  private subscribers = new Set<(s: LiveState) => void>()

  constructor(private deps: LiveDeps) {
    const s = deps.settings.get()
    this.state = {
      content: { type: 'none' },
      overlay: 'none',
      background: s.background,
      style: s.style,
      logoMediaId: s.logoMediaId,
      cursor: { itemId: null, slideIndex: 0 }
    }
    deps.settings.onChange((n) => {
      this.state = { ...this.state, background: n.background, style: n.style, logoMediaId: n.logoMediaId }
      this.emit()
    })
  }

  get(): LiveState {
    return this.state
  }

  subscribe(cb: (s: LiveState) => void): () => void {
    this.subscribers.add(cb)
    return () => {
      this.subscribers.delete(cb)
    }
  }

  private emit(): void {
    this.deps.send(this.state)
    for (const cb of this.subscribers) cb(this.state)
  }

  /** ausente, YouTube sem internet, ou música/Bíblia sem nenhum slide */
  private skipOf(e: { resolved: ResolvedItem; slides: Slide[] }): boolean {
    const kind = e.resolved.item.data.kind
    return (
      e.resolved.missing ||
      (kind === 'youtube' && !this.online) ||
      ((kind === 'song' || kind === 'bible') && e.slides.length === 0)
    )
  }

  /**
   * (Re)carrega o culto. O telão nunca muda sozinho por causa disso, exceto quando o texto do
   * que está no ar foi editado (retransmite o slide novo, com o índice ajustado).
   * - mesmo culto, item ao vivo ainda existe: cursor mantido;
   * - mesmo culto, item ao vivo removido: cursor sem item, com `gap` na posição que ele ocupava;
   * - outro culto: cursor sem posição; o conteúdo atual fica até o operador navegar.
   */
  loadService(serviceId: ID): void {
    const svc = this.deps.services.get(serviceId)
    const oldIndex = this.indexOf(this.state.cursor.itemId)
    this.entries = (svc?.items ?? []).map((item) => {
      const resolved = resolveItem(item, this.deps.resolveDeps)
      const slides = buildSlides(resolved, this.deps)
      return { resolved, slides, skip: this.skipOf({ resolved, slides }) }
    })
    const sameService = this.serviceId === serviceId
    this.serviceId = serviceId
    const cur = this.state.cursor
    if (!sameService) {
      if (cur.itemId !== null || cur.gap !== undefined) this.setCursor({ itemId: null, slideIndex: 0 })
      return
    }
    if (cur.itemId === null) return
    const idx = this.indexOf(cur.itemId)
    if (idx < 0) {
      this.setCursor({ itemId: null, slideIndex: 0, gap: oldIndex < 0 ? 0 : oldIndex })
      return
    }
    const e = this.entries[idx]
    // sem slides válidos agora (ex.: música apagada): o telão fica como está até navegar
    if (e.skip) return
    const slideIndex = Math.min(cur.slideIndex, Math.max(1, e.slides.length) - 1)
    const content = this.state.content
    const fresh = this.contentFor(e, slideIndex)
    // só texto é retransmitido; mídia/YouTube no ar seguem tocando como estão
    const textChanged =
      content.type === 'slide' && fresh.type === 'slide' && JSON.stringify(content.slide) !== JSON.stringify(fresh.slide)
    if (!textChanged && slideIndex === cur.slideIndex) return
    this.state = {
      ...this.state,
      content: textChanged ? fresh : content,
      cursor: { itemId: cur.itemId, slideIndex }
    }
    this.emit()
  }

  private indexOf(itemId: ID | null): number {
    return itemId === null ? -1 : this.entries.findIndex((e) => e.resolved.item.id === itemId)
  }

  private setCursor(cursor: LiveState['cursor']): void {
    this.state = { ...this.state, cursor }
    this.emit()
  }

  /** itens do culto carregado com seus slides (para a grade e a prévia do operador) */
  outline(): { itemId: ID; skip: boolean; slides: Slide[] }[] {
    return this.entries.map((e) => ({ itemId: e.resolved.item.id, skip: e.skip, slides: e.slides }))
  }

  setOnline(online: boolean): void {
    this.online = online
    for (const e of this.entries) e.skip = this.skipOf(e)
  }

  /** mídia apagada depois do carregamento também é pulada (goTo nela seria ignorado) */
  private nav() {
    return this.entries.map((e) => {
      const d = e.resolved.item.data
      const gone = d.kind === 'media' && !this.deps.media.get(d.mediaId)
      return { slideCount: e.slides.length, skip: e.skip || gone }
    })
  }

  private contentFor(e: Entry, slideIndex: number): LiveContent {
    const d = e.resolved.item.data
    if (d.kind === 'media') {
      const media = this.deps.media.get(d.mediaId)
      return media ? { type: 'media', media, playing: false, volume: 1, position: 0 } : { type: 'none' }
    }
    if (d.kind === 'youtube') return { type: 'youtube', videoId: d.videoId, playing: false, volume: 1, position: 0 }
    const slide = e.slides[slideIndex]
    return slide ? { type: 'slide', slide } : { type: 'none' }
  }

  /** ignorado se o item não existe, deve ser pulado ou não teria nada a mostrar (nunca tela vazia) */
  goTo(itemId: ID, slideIndex: number): void {
    const idx = this.indexOf(itemId)
    if (idx < 0 || this.entries[idx].skip) return
    const e = this.entries[idx]
    const last = Math.max(1, e.slides.length) - 1
    const slide = Math.max(0, Math.min(Math.trunc(slideIndex) || 0, last))
    const content = this.contentFor(e, slide)
    if (content.type === 'none') return
    this.state = { ...this.state, content, cursor: { itemId, slideIndex: slide } }
    this.emit()
  }

  private step(fn: typeof nextFromCursor): void {
    const cur = this.state.cursor
    const pos = fn(this.nav(), this.indexOf(cur.itemId), cur.slideIndex, cur.gap ?? null)
    if (pos) this.goTo(this.entries[pos.item].resolved.item.id, pos.slide)
  }

  next(): void {
    this.step(nextFromCursor)
  }

  prev(): void {
    this.step(prevFromCursor)
  }

  setOverlay(overlay: Overlay): void {
    this.state = { ...this.state, overlay }
    this.emit()
  }

  media(cmd: { play?: boolean; volume?: number; position?: number }): void {
    const c = this.state.content
    if (c.type !== 'media' && c.type !== 'youtube') return
    this.state = {
      ...this.state,
      content: {
        ...c,
        playing: cmd.play ?? c.playing,
        volume: cmd.volume ?? c.volume,
        position: cmd.position ?? c.position,
        seek: cmd.position === undefined ? c.seek : (c.seek ?? 0) + 1
      }
    }
    this.emit()
  }
}
