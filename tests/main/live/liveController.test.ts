import { expect, test, vi } from 'vitest'
import { LiveController } from '../../../src/main/live/liveController'
import { DEFAULT_SETTINGS } from '../../../src/shared/defaults'
import type { LiveState, ServiceItem, ServiceItemData, Settings } from '../../../src/shared/types'

function setup() {
  const data: ServiceItemData[] = [
    { kind: 'song', songId: 's1' },
    { kind: 'song', songId: 'gone' },
    { kind: 'youtube', videoId: 'v', title: 'Y', thumbnail: '' },
    { kind: 'media', mediaId: 'm1' },
    { kind: 'notice', title: 'A', body: 'corpo', backgroundMediaId: null }
  ]
  const items: ServiceItem[] = data.map((d, i) => ({ id: `i${i}`, serviceId: 'sv', position: i, data: d }))
  const song = {
    id: 's1',
    title: 'S',
    parts: [{ id: 'p1', label: 'E1', slides: ['a', 'b'] }],
    arrangement: ['p1']
  }
  const media = { id: 'm1', kind: 'video', originalName: 'v.mp4', fileName: 'f', mime: 'video/mp4' }
  let settings: Settings = structuredClone(DEFAULT_SETTINGS)
  let listener: ((s: Settings) => void) | null = null
  const sent: LiveState[] = []
  const live = new LiveController({
    services: { get: () => ({ id: 'sv', name: 'n', date: 'd', items }) },
    resolveDeps: {
      songs: { get: (id: string) => (id === 's1' ? song : null) },
      media: { get: (id: string) => (id === 'm1' ? media : null) }
    } as any,
    song: (id: string) => (id === 's1' ? (song as any) : null),
    passage: () => null,
    media: { get: (id: string) => (id === 'm1' ? (media as any) : null) },
    settings: {
      get: () => settings,
      onChange: (f: (s: Settings) => void) => {
        listener = f
        return () => {}
      }
    },
    send: (s) => sent.push(s)
  })
  live.loadService('sv')
  const setSettings = (s: Settings): void => {
    settings = s
    listener?.(s)
  }
  return { live, sent, setSettings }
}

test('estado inicial vem das configurações', () => {
  const { live } = setup()
  const s = live.get()
  expect(s.content).toEqual({ type: 'none' })
  expect(s.overlay).toBe('none')
  expect(s.cursor).toEqual({ itemId: null, slideIndex: 0 })
  expect(s.style).toEqual(DEFAULT_SETTINGS.style)
})

test('goTo emite estado; overlay black mantém content', () => {
  const { live, sent } = setup()
  live.goTo('i0', 1)
  expect(live.get().content).toMatchObject({ type: 'slide', slide: { text: 'b' } })
  expect(live.get().cursor).toEqual({ itemId: 'i0', slideIndex: 1 })
  const n = sent.length
  live.setOverlay('black')
  expect(sent.length).toBe(n + 1)
  expect(live.get().overlay).toBe('black')
  expect(live.get().content).toMatchObject({ type: 'slide' })
})

test('goTo clampa slideIndex fora do intervalo', () => {
  const { live } = setup()
  live.goTo('i0', 99)
  expect(live.get().cursor.slideIndex).toBe(1)
})

test('goTo em item ausente é ignorado; next pula ausente e vai ao YouTube', () => {
  const { live } = setup()
  live.goTo('i0', 1)
  const before = live.get()
  live.goTo('i1', 0)
  expect(live.get()).toEqual(before)
  live.next()
  expect(live.get().cursor.itemId).toBe('i2')
  expect(live.get().content).toMatchObject({ type: 'youtube', videoId: 'v', playing: false, volume: 1, position: 0 })
})

test('setOnline(false) faz next pular o YouTube e goTo nele é ignorado', () => {
  const { live } = setup()
  live.goTo('i0', 1)
  live.setOnline(false)
  live.next()
  expect(live.get().cursor.itemId).toBe('i3')
  expect(live.get().content).toMatchObject({ type: 'media', playing: false })
  live.goTo('i2', 0)
  expect(live.get().cursor.itemId).toBe('i3')
})

test('setOnline(false) com YouTube no ar não altera o estado', () => {
  const { live } = setup()
  live.goTo('i2', 0)
  const before = live.get()
  live.setOnline(false)
  expect(live.get()).toEqual(before)
})

test('next no fim do culto não muda; prev volta', () => {
  const { live } = setup()
  live.goTo('i4', 0)
  const before = live.get()
  live.next()
  expect(live.get()).toEqual(before)
  live.prev()
  expect(live.get().cursor.itemId).toBe('i3')
})

test('media() atualiza play/volume/position', () => {
  const { live } = setup()
  live.goTo('i3', 0)
  live.media({ play: true, volume: 0.5, position: 12 })
  expect(live.get().content).toMatchObject({ playing: true, volume: 0.5, position: 12 })
})

test('mudança de configurações atualiza e retransmite o estado', () => {
  const { live, sent, setSettings } = setup()
  const n = sent.length
  setSettings({ ...DEFAULT_SETTINGS, logoMediaId: 'L' })
  expect(live.get().logoMediaId).toBe('L')
  expect(sent.length).toBe(n + 1)
})

test('subscribe recebe mudanças', () => {
  const { live } = setup()
  const f = vi.fn()
  live.subscribe(f)
  live.goTo('i0', 0)
  expect(f).toHaveBeenCalledOnce()
})

test('outline lista itens com slides e skip', () => {
  const { live } = setup()
  const o = live.outline()
  expect(o.map((e) => e.itemId)).toEqual(['i0', 'i1', 'i2', 'i3', 'i4'])
  expect(o[0].slides.map((x) => x.text)).toEqual(['a', 'b'])
  expect(o[1].skip).toBe(true)
  expect(o[2].slides).toEqual([])
})
