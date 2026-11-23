import { beforeEach, expect, test } from 'vitest'
import { openDatabase, type Db } from '../../../src/main/db/database'
import { createSongsRepo, type SongInput } from '../../../src/main/repos/songs'

let db: Db
let repo: ReturnType<typeof createSongsRepo>

const input = (over: Partial<SongInput> = {}): SongInput => ({
  title: 'Grande é o Senhor',
  artist: 'Ministério X',
  key: 'G',
  tags: ['louvor'],
  lyrics: '[Estrofe 1]\nGrande é o Senhor\n\n[Refrão]\nAleluia\n\n[Refrão]',
  attachment: null,
  ...over
})

beforeEach(() => {
  db = openDatabase(':memory:')
  repo = createSongsRepo(db)
})

test('create e get', () => {
  const s = repo.create(input())
  expect(s.parts.map((p) => p.label)).toEqual(['Estrofe 1', 'Refrão'])
  expect(s.arrangement).toEqual([s.parts[0].id, s.parts[1].id, s.parts[1].id])
  expect(repo.get(s.id)).toEqual(s)
  expect(repo.get('nope')).toBeNull()
})

test('busca por título, artista e trecho da letra, sem acentos/maiúsculas', () => {
  const s = repo.create(input())
  repo.create(input({ title: 'Outra', artist: 'Fulano', lyrics: 'nada a ver' }))
  expect(repo.list().length).toBe(2)
  expect(repo.list('ALELUIA').map((x) => x.id)).toEqual([s.id])
  expect(repo.list('senhor').map((x) => x.id)).toEqual([s.id])
  expect(repo.list('ministerio').map((x) => x.id)).toEqual([s.id])
  expect(repo.list('fulano')).toHaveLength(1)
  expect(repo.list('100%')).toHaveLength(0)
})

test('update troca as partes e atualiza a busca', () => {
  const s = repo.create(input())
  const u = repo.update(s.id, input({ lyrics: '[Verso]\nNovo texto' }))
  expect(u.id).toBe(s.id)
  expect(u.createdAt).toBe(s.createdAt)
  expect(u.parts.map((p) => p.label)).toEqual(['Verso'])
  expect(u.arrangement).toEqual([u.parts[0].id])
  expect(repo.list('aleluia')).toHaveLength(0)
  expect(repo.list('novo')).toHaveLength(1)
  expect((db.prepare('select count(*) c from song_parts').get() as { c: number }).c).toBe(1)
})

test('setArrangement e remove', () => {
  const s = repo.create(input())
  const [a, b] = s.parts
  expect(repo.setArrangement(s.id, [b.id, a.id]).arrangement).toEqual([b.id, a.id])
  repo.remove(s.id)
  expect(repo.get(s.id)).toBeNull()
  expect((db.prepare('select count(*) c from song_parts').get() as { c: number }).c).toBe(0)
})
