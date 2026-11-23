import type { ID, LiveContent, LiveState, MediaItem, Overlay, ResolvedItem, Service, Settings, Slide } from '../../shared/types'
import { buildSlides, type SlideDeps } from '../../shared/slides'
import { nextPosition, prevPosition } from '../../shared/navigation'
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

  private skipOf(e: { resolved: ResolvedItem }): boolean {
    return e.resolved.missing || (e.resolved.item.data.kind === 'youtube' && !this.online)
  }

  loadService(serviceId: ID): void {
    const svc = this.deps.services.get(serviceId)
    this.entries = (svc?.items ?? []).map((item) => {
      const resolved = resolveItem(item, this.deps.resolveDeps)
      return { resolved, slides: buildSlides(resolved, this.deps), skip: this.skipOf({ resolved }) }
    })
  }

  setOnline(online: boolean): void {
    this.online = online
    for (const e of this.entries) e.skip = this.skipOf(e)
  }

  private nav() {
    return this.entries.map((e) => ({ slideCount: e.slides.length, skip: e.skip }))
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

  goTo(itemId: ID, slideIndex: number): void {
    const idx = this.entries.findIndex((e) => e.resolved.item.id === itemId)
    if (idx < 0 || this.entries[idx].skip) return
    const e = this.entries[idx]
    const last = Math.max(1, e.slides.length) - 1
    const slide = Math.max(0, Math.min(Math.trunc(slideIndex) || 0, last))
    this.state = { ...this.state, content: this.contentFor(e, slide), cursor: { itemId, slideIndex: slide } }
    this.emit()
  }

  private step(fn: typeof nextPosition): void {
    const items = this.nav()
    const cur = this.state.cursor
    const at = cur.itemId === null ? -1 : this.entries.findIndex((e) => e.resolved.item.id === cur.itemId)
    let pos
    if (at < 0) {
      // sem posição atual: avançar vai ao primeiro item válido; voltar não faz nada
      if (fn !== nextPosition) return
      const first = items.findIndex((i) => !i.skip)
      pos = first < 0 ? null : { item: first, slide: 0 }
    } else {
      pos = fn(items, { item: at, slide: cur.slideIndex })
    }
    if (pos) this.goTo(this.entries[pos.item].resolved.item.id, pos.slide)
  }

  next(): void {
    this.step(nextPosition)
  }

  prev(): void {
    this.step(prevPosition)
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
        position: cmd.position ?? c.position
      }
    }
    this.emit()
  }
}
