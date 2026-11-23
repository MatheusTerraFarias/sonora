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

test('culto [música, YouTube, aviso] sem internet: next pula o YouTube e goTo nele não muda o estado', () => {
  const data: ServiceItemData[] = [
    { kind: 'song', songId: 's1' },
    { kind: 'youtube', videoId: 'dQw4w9WgXcQ', title: 'Y', thumbnail: '' },
    { kind: 'notice', title: 'Aviso', body: 'corpo', backgroundMediaId: null }
  ]
  const items: ServiceItem[] = data.map((d, i) => ({ id: `k${i}`, serviceId: 'sv2', position: i, data: d }))
  const song = { id: 's1', title: 'S', parts: [{ id: 'p1', label: 'E1', slides: ['a', 'b'] }], arrangement: ['p1'] }
  const live = new LiveController({
    services: { get: () => ({ id: 'sv2', name: 'n', date: 'd', items }) },
    resolveDeps: { songs: { get: () => song }, media: { get: () => null } } as any,
    song: () => song as any,
    passage: () => null,
    media: { get: () => null },
    settings: { get: () => structuredClone(DEFAULT_SETTINGS), onChange: () => () => {} },
    send: () => {}
  })
  live.loadService('sv2')
  live.setOnline(false)
  live.goTo('k0', 1)
  live.next()
  expect(live.get().cursor).toEqual({ itemId: 'k2', slideIndex: 0 })
  expect(live.get().content).toMatchObject({ type: 'slide' })
  const before = live.get()
  live.goTo('k1', 0)
  expect(live.get()).toBe(before)
})

test('media() com position incrementa seek, mesmo repetindo o valor', () => {
  const { live } = setup()
  live.goTo('i3', 0)
  live.media({ position: 30 })
  const a = (live.get().content as { seek?: number }).seek
  live.media({ position: 30 })
  const b = (live.get().content as { seek?: number }).seek
  live.media({ volume: 0.2 })
  const c = (live.get().content as { seek?: number }).seek
  expect(a).toBe(1)
  expect(b).toBe(2)
  expect(c).toBe(2)
})

/** culto editável: itens, músicas e mídias podem mudar entre um loadService e outro */
function mutable() {
  const song = (id: string, slides: string[]) => ({
    id,
    title: id,
    parts: [{ id: 'p', label: 'E', slides }],
    arrangement: slides.length ? ['p'] : []
  })
  const songs = new Map<string, ReturnType<typeof song>>([
    ['a', song('a', ['a1', 'a2'])],
    ['b', song('b', ['b1', 'b2', 'b3'])],
    ['c', song('c', ['c1'])],
    ['vazia', song('vazia', [])]
  ])
  const medias = new Map<string, any>([['m', { id: 'm', kind: 'video', originalName: 'v.mp4', fileName: 'f', mime: 'video/mp4' }]])
  const lists = new Map<string, { id: string; data: ServiceItemData }[]>()
  const setService = (sid: string, list: { id: string; data: ServiceItemData }[]): void => {
    lists.set(sid, list)
  }
  const sent: LiveState[] = []
  const live = new LiveController({
    services: {
      get: (sid: string) => {
        const list = lists.get(sid)
        return list
          ? { id: sid, name: 'n', date: 'd', items: list.map((x, i) => ({ id: x.id, serviceId: sid, position: i, data: x.data })) }
          : null
      }
    },
    resolveDeps: { songs: { get: (id: string) => songs.get(id) ?? null }, media: { get: (id: string) => medias.get(id) ?? null } } as any,
    song: (id: string) => (songs.get(id) as any) ?? null,
    passage: () => null,
    media: { get: (id: string) => medias.get(id) ?? null },
    settings: { get: () => structuredClone(DEFAULT_SETTINGS), onChange: () => () => {} },
    send: (s) => sent.push(s)
  })
  return { live, sent, songs, song, medias, setService }
}

const S = (id: string, songId: string) => ({ id, data: { kind: 'song', songId } as ServiceItemData })
const M = (id: string, mediaId: string) => ({ id, data: { kind: 'media', mediaId } as ServiceItemData })
const textOf = (s: LiveState): string => (s.content.type === 'slide' ? s.content.slide.text : '')

test('item ao vivo removido: o telão mantém o conteúdo; next continua do vizinho', () => {
  const { live, setService } = mutable()
  setService('sv', [S('x', 'a'), S('y', 'b'), S('z', 'c')])
  live.loadService('sv')
  live.goTo('y', 1)
  setService('sv', [S('x', 'a'), S('z', 'c')])
  live.loadService('sv')
  expect(textOf(live.get())).toBe('b2')
  live.next()
  expect(live.get().cursor).toMatchObject({ itemId: 'z', slideIndex: 0 })
})

test('item ao vivo removido: prev vai ao item anterior (nunca ao primeiro)', () => {
  const { live, setService } = mutable()
  setService('sv', [S('w', 'c'), S('x', 'a'), S('y', 'b'), S('z', 'c')])
  live.loadService('sv')
  live.goTo('y', 0)
  setService('sv', [S('w', 'c'), S('x', 'a'), S('z', 'c')])
  live.loadService('sv')
  live.prev()
  expect(live.get().cursor).toMatchObject({ itemId: 'x', slideIndex: 1 })
})

test('item ao vivo reordenado: mantém o cursor e next segue a nova ordem', () => {
  const { live, setService, sent } = mutable()
  setService('sv', [S('x', 'a'), S('y', 'b'), S('z', 'c')])
  live.loadService('sv')
  live.goTo('x', 1)
  const n = sent.length
  setService('sv', [S('y', 'b'), S('x', 'a'), S('z', 'c')])
  live.loadService('sv')
  expect(sent.length).toBe(n)
  expect(live.get().cursor).toMatchObject({ itemId: 'x', slideIndex: 1 })
  live.next()
  expect(live.get().cursor).toMatchObject({ itemId: 'z', slideIndex: 0 })
})

test('música ao vivo editada: retransmite com o índice ajustado ao novo número de slides', () => {
  const { live, setService, songs, song, sent } = mutable()
  setService('sv', [S('x', 'b')])
  live.loadService('sv')
  live.goTo('x', 2)
  songs.set('b', song('b', ['novo1', 'novo2']))
  const n = sent.length
  live.loadService('sv')
  expect(sent.length).toBe(n + 1)
  expect(live.get().cursor).toMatchObject({ itemId: 'x', slideIndex: 1 })
  expect(textOf(live.get())).toBe('novo2')
})

test('recarregar sem mudança visível não retransmite', () => {
  const { live, setService, sent } = mutable()
  setService('sv', [S('x', 'b')])
  live.loadService('sv')
  live.goTo('x', 1)
  const n = sent.length
  live.loadService('sv')
  expect(sent.length).toBe(n)
})

test('outro culto: cursor sem posição, conteúdo mantido até navegar', () => {
  const { live, setService } = mutable()
  setService('sv', [S('x', 'a'), S('y', 'b')])
  setService('sv2', [S('k', 'c'), S('l', 'b')])
  live.loadService('sv')
  live.goTo('y', 1)
  live.loadService('sv2')
  expect(live.get().cursor.itemId).toBeNull()
  expect(textOf(live.get())).toBe('b2')
  live.prev()
  expect(textOf(live.get())).toBe('b2')
  live.next()
  expect(live.get().cursor).toMatchObject({ itemId: 'k', slideIndex: 0 })
})

test('música ou Bíblia com 0 slides conta como skip', () => {
  const { live, setService } = mutable()
  setService('sv', [S('x', 'a'), S('v', 'vazia'), { id: 'bb', data: { kind: 'bible', ref: 'Xx 99:99', translation: 't' } }, S('z', 'c')])
  live.loadService('sv')
  expect(live.outline().map((o) => o.skip)).toEqual([false, true, true, false])
  live.goTo('x', 1)
  live.next()
  expect(live.get().cursor.itemId).toBe('z')
  const before = live.get()
  live.goTo('v', 0)
  expect(live.get()).toBe(before)
})

test('goTo em mídia apagada depois do carregamento é ignorado (sem tela vazia)', () => {
  const { live, setService, medias } = mutable()
  setService('sv', [S('x', 'a'), M('mm', 'm')])
  live.loadService('sv')
  live.goTo('x', 0)
  medias.delete('m')
  const before = live.get()
  live.goTo('mm', 0)
  expect(live.get()).toBe(before)
})

test('next pula mídia apagada depois do carregamento', () => {
  const { live, setService, medias } = mutable()
  setService('sv', [S('x', 'c'), M('mm', 'm'), S('z', 'c')])
  live.loadService('sv')
  live.goTo('x', 0)
  medias.delete('m')
  live.next()
  expect(live.get().cursor.itemId).toBe('z')
})
