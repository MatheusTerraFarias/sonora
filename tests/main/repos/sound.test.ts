import { beforeEach, expect, test } from 'vitest'
import { openDatabase, type Db } from '../../../src/main/db/database'
import { createSoundRepo } from '../../../src/main/repos/sound'
import { createServicesRepo } from '../../../src/main/repos/services'
import type { SoundChannel } from '../../../src/shared/sound'

let db: Db
let repo: ReturnType<typeof createSoundRepo>
let services: ReturnType<typeof createServicesRepo>

const ch = (number: number, name: string, inputIndex: number | null = null): SoundChannel => ({
  id: `c${number}${name}`,
  number,
  name,
  person: '',
  kind: 'wired',
  notes: '',
  inputIndex
})

beforeEach(() => {
  db = openDatabase(':memory:')
  repo = createSoundRepo(db)
  services = createServicesRepo(db)
})

test('cria mapa vazio e lista', () => {
  const m = repo.create('Principal')
  expect(m).toMatchObject({ name: 'Principal', channels: [], checklist: [] })
  expect(m.id).toBeTruthy()
  expect(repo.get(m.id)).toEqual(m)
  expect(repo.list().map((x) => x.id)).toEqual([m.id])
  expect(repo.get('nope')).toBeNull()
})

test('save renumera canais 1..n na ordem do array', () => {
  const m = repo.create('M')
  const saved = repo.save({ ...m, channels: [ch(5, 'a'), ch(1, 'b'), ch(9, 'c')] })
  expect(saved.channels.map((c) => [c.number, c.name])).toEqual([[1, 'a'], [2, 'b'], [3, 'c']])
  expect(repo.get(m.id)!.channels.map((c) => c.number)).toEqual([1, 2, 3])
})

test('inputIndex inválido vira null; válido é mantido', () => {
  const m = repo.create('M')
  const saved = repo.save({
    ...m,
    channels: [ch(1, 'a', -1), ch(2, 'b', 2.5), ch(3, 'c', 0), ch(4, 'd', 7), ch(5, 'e', null)]
  })
  expect(saved.channels.map((c) => c.inputIndex)).toEqual([null, null, 0, 7, null])
})

test('itens sem id recebem id novo', () => {
  const m = repo.create('M')
  const saved = repo.save({
    ...m,
    channels: [{ ...ch(1, 'a'), id: '' }],
    checklist: [{ id: '', text: 'ligar' }, { id: 'k', text: 'testar' }]
  })
  expect(saved.channels[0].id).toBeTruthy()
  expect(saved.checklist[0].id).toBeTruthy()
  expect(saved.checklist[1].id).toBe('k')
})

test('duplicate copia com nome novo e ids novos', () => {
  const m = repo.create('M')
  repo.save({ ...m, channels: [ch(1, 'a')], checklist: [{ id: 'k', text: 't' }] })
  const d = repo.duplicate(m.id, 'Cópia')
  expect(d.id).not.toBe(m.id)
  expect(d.name).toBe('Cópia')
  expect(d.channels[0]).toMatchObject({ name: 'a' })
  expect(d.channels[0].id).not.toBe('c1a')
  expect(d.checklist[0].text).toBe('t')
})

test('getForService sem registro devolve o padrão', () => {
  const s = services.create('C', '2026-11-22')
  expect(repo.getForService(s.id)).toEqual({ serviceId: s.id, mapId: null, checked: [], channelNotes: {} })
})

test('setForService mescla o patch', () => {
  const s = services.create('C', '2026-11-22')
  const m = repo.create('M')
  repo.setForService(s.id, { mapId: m.id })
  const r = repo.setForService(s.id, { checked: ['k'], channelNotes: { x: 'n' } })
  expect(r).toEqual({ serviceId: s.id, mapId: m.id, checked: ['k'], channelNotes: { x: 'n' } })
  expect(repo.getForService(s.id)).toEqual(r)
})

test('apagar o mapa deixa mapId null no culto', () => {
  const s = services.create('C', '2026-11-22')
  const m = repo.create('M')
  repo.setForService(s.id, { mapId: m.id, checked: ['k'] })
  repo.remove(m.id)
  expect(repo.getForService(s.id)).toMatchObject({ mapId: null, checked: ['k'] })
})

test('apagar o culto remove o registro', () => {
  const s = services.create('C', '2026-11-22')
  repo.setForService(s.id, { checked: ['k'] })
  services.remove(s.id)
  expect(db.prepare('SELECT COUNT(*) AS n FROM service_sound').get()).toEqual({ n: 0 })
})

test('JSON corrompido não lança', () => {
  const m = repo.create('M')
  db.prepare('UPDATE sound_maps SET channels = ?, checklist = ? WHERE id = ?').run('{x', 'null', m.id)
  expect(repo.get(m.id)).toMatchObject({ channels: [], checklist: [] })
  expect(repo.list()).toHaveLength(1)
  const s = services.create('C', '2026-11-22')
  repo.setForService(s.id, { mapId: m.id })
  db.prepare('UPDATE service_sound SET checked = ?, channel_notes = ? WHERE service_id = ?').run('oops', '[1]', s.id)
  expect(repo.getForService(s.id)).toEqual({ serviceId: s.id, mapId: m.id, checked: [], channelNotes: {} })
})

test('duplicar culto copia mapId e zera checked/notas', () => {
  const s = services.create('C', '2026-11-22')
  const m = repo.create('M')
  repo.setForService(s.id, { mapId: m.id, checked: ['k'], channelNotes: { a: 'b' } })
  const d = services.duplicate(s.id, '2026-11-29')
  expect(repo.getForService(d.id)).toEqual({ serviceId: d.id, mapId: m.id, checked: [], channelNotes: {} })
  expect(repo.getForService(s.id).checked).toEqual(['k'])
})

test('duplicar culto sem registro de som não cria registro', () => {
  const s = services.create('C', '2026-11-22')
  const d = services.duplicate(s.id, '2026-11-29')
  expect(db.prepare('SELECT COUNT(*) AS n FROM service_sound WHERE service_id = ?').get(d.id)).toEqual({ n: 0 })
})
