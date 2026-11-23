import { beforeEach, expect, test } from 'vitest'
import { openDatabase, type Db } from '../../../src/main/db/database'
import { createServicesRepo, resolveItem } from '../../../src/main/repos/services'
import { createFavoritesRepo } from '../../../src/main/repos/favorites'
import { createSongsRepo } from '../../../src/main/repos/songs'
import { strings } from '../../../src/main/strings'

let db: Db
let repo: ReturnType<typeof createServicesRepo>

const notice = (title: string) => ({ kind: 'notice' as const, title, body: '', backgroundMediaId: null })
const titles = (s: { items: { data: any }[] }) => s.items.map((i) => i.data.title)

beforeEach(() => {
  db = openDatabase(':memory:')
  repo = createServicesRepo(db)
})

test('create, get, list, rename, remove', () => {
  const s = repo.create('Culto', '2026-11-22')
  expect(repo.get(s.id)).toEqual({ id: s.id, name: 'Culto', date: '2026-11-22', items: [] })
  expect(repo.list()).toEqual([{ id: s.id, name: 'Culto', date: '2026-11-22' }])
  expect(repo.rename(s.id, 'Domingo', '2026-11-29')).toMatchObject({ name: 'Domingo', date: '2026-11-29' })
  repo.remove(s.id)
  expect(repo.get(s.id)).toBeNull()
})

test('addItem na posição e posições contínuas', () => {
  const s = repo.create('C', '2026-11-22')
  repo.addItem(s.id, notice('a'))
  repo.addItem(s.id, notice('b'))
  repo.addItem(s.id, notice('c'), 1)
  const got = repo.get(s.id)!
  expect(titles(got)).toEqual(['a', 'c', 'b'])
  expect(got.items.map((i) => i.position)).toEqual([0, 1, 2])
})

test('moveItem reordena mantendo posições contínuas', () => {
  const s = repo.create('C', '2026-11-22')
  const a = repo.addItem(s.id, notice('a'))
  repo.addItem(s.id, notice('b'))
  repo.addItem(s.id, notice('c'))
  const moved = repo.moveItem(a.id, 2)
  expect(titles(moved)).toEqual(['b', 'c', 'a'])
  expect(moved.items.map((i) => i.position)).toEqual([0, 1, 2])
  expect(titles(repo.moveItem(a.id, 0))).toEqual(['a', 'b', 'c'])
})

test('removeItem recompacta posições; updateItem troca dados', () => {
  const s = repo.create('C', '2026-11-22')
  const a = repo.addItem(s.id, notice('a'))
  const b = repo.addItem(s.id, notice('b'))
  repo.addItem(s.id, notice('c'))
  repo.removeItem(a.id)
  const got = repo.get(s.id)!
  expect(got.items.map((i) => i.position)).toEqual([0, 1])
  expect(repo.updateItem(b.id, notice('B2')).data).toEqual(notice('B2'))
  expect(titles(repo.get(s.id)!)).toEqual(['B2', 'c'])
})

test('duplicate copia itens com novos ids', () => {
  const s = repo.create('C', '2026-11-22')
  repo.addItem(s.id, notice('a'))
  repo.addItem(s.id, notice('b'))
  const copy = repo.duplicate(s.id, '2026-11-29')
  expect(copy.id).not.toBe(s.id)
  expect(copy.date).toBe('2026-11-29')
  expect(titles(copy)).toEqual(['a', 'b'])
  const orig = repo.get(s.id)!
  const ids = new Set([...orig.items, ...copy.items].map((i) => i.id))
  expect(ids.size).toBe(4)
  expect(copy.items.every((i) => i.serviceId === copy.id)).toBe(true)
})

test('resolveItem: música apagada fica missing com "Item removido"', () => {
  const songs = createSongsRepo(db)
  const song = songs.create({ title: 'Grande é o Senhor', artist: '', key: null, tags: [], lyrics: '[Verso]\nLinha', attachment: null } as any)
  const s = repo.create('C', '2026-11-22')
  const item = repo.addItem(s.id, { kind: 'song', songId: song.id })
  const deps = { songs: { get: (id: string) => songs.get(id) }, media: { list: () => [] } }
  expect(resolveItem(item, deps)).toEqual({ item, missing: false, title: 'Grande é o Senhor' })
  songs.remove(song.id)
  const r = resolveItem(item, deps)
  expect(r.missing).toBe(true)
  expect(r.title).toBe(strings.services.removedItem)
  expect(strings.services.removedItem).toBe('Item removido')
})

test('resolveItem: outros tipos e mídia ausente', () => {
  const s = repo.create('C', '2026-11-22')
  const deps = { songs: { get: () => null }, media: { list: () => [{ id: 'm1', originalName: 'foto.png' }] as any } }
  const bible = repo.addItem(s.id, { kind: 'bible', ref: 'João 3:16', translation: 'ara' })
  const yt = repo.addItem(s.id, { kind: 'youtube', videoId: 'v', title: 'Vídeo', thumbnail: '' })
  const n = repo.addItem(s.id, notice('Aviso'))
  const m = repo.addItem(s.id, { kind: 'media', mediaId: 'm1' })
  const gone = repo.addItem(s.id, { kind: 'media', mediaId: 'x' })
  expect(resolveItem(bible, deps)).toMatchObject({ missing: false, title: 'João 3:16' })
  expect(resolveItem(yt, deps)).toMatchObject({ missing: false, title: 'Vídeo' })
  expect(resolveItem(n, deps)).toMatchObject({ missing: false, title: 'Aviso' })
  expect(resolveItem(m, deps)).toMatchObject({ missing: false, title: 'foto.png' })
  expect(resolveItem(gone, deps)).toMatchObject({ missing: true, title: 'Item removido' })
})

test('favoritos: repetido não duplica; remove', () => {
  const fav = createFavoritesRepo(db)
  const v = { videoId: 'abc', title: 'T', channel: 'C', thumbnail: 'u' }
  fav.add(v)
  fav.add({ ...v, title: 'T2' })
  expect(fav.list()).toEqual([v])
  fav.add({ ...v, videoId: 'def' })
  expect(fav.list()).toHaveLength(2)
  fav.remove('abc')
  expect(fav.list().map((f) => f.videoId)).toEqual(['def'])
})
