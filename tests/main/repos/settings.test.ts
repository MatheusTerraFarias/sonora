import { beforeEach, expect, test, vi } from 'vitest'
import { openDatabase, type Db } from '../../../src/main/db/database'
import { createSettingsRepo } from '../../../src/main/repos/settings'
import { DEFAULT_SETTINGS } from '../../../src/shared/defaults'

let db: Db
let repo: ReturnType<typeof createSettingsRepo>

beforeEach(() => {
  db = openDatabase(':memory:')
  repo = createSettingsRepo(db)
})

test('banco vazio retorna os padrões', () => {
  expect(repo.get()).toEqual(DEFAULT_SETTINGS)
  expect(repo.get().adblockEnabled).toBe(false)
})

test('get retorna cópia profunda: mutar style não altera get seguinte', () => {
  const s = repo.get()
  s.style.color = '#000000'
  s.background.color = '#111111'
  expect(repo.get().style.color).toBe(DEFAULT_SETTINGS.style.color)
  expect(repo.get().background.color).toBe(DEFAULT_SETTINGS.background.color)
})

test('update persiste, retorna o merge e notifica onChange', () => {
  const cb = vi.fn()
  repo.onChange(cb)
  const result = repo.update({ churchName: 'X' })
  expect(result).toEqual({ ...DEFAULT_SETTINGS, churchName: 'X' })
  expect(createSettingsRepo(db).get().churchName).toBe('X')
  expect(cb).toHaveBeenCalledTimes(1)
  expect(cb).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, churchName: 'X' })
})

test('update grava só as chaves do patch (uma linha por chave)', () => {
  repo.update({ churchName: 'X', adblockEnabled: true })
  const keys = (db.prepare('SELECT key FROM settings ORDER BY key').all() as { key: string }[]).map((r) => r.key)
  expect(keys).toEqual(['adblockEnabled', 'churchName'])
})

test('chaves desconhecidas no patch são ignoradas', () => {
  const result = repo.update({ churchName: 'Y', foo: 'bar' } as any)
  expect(result).not.toHaveProperty('foo')
  const keys = (db.prepare('SELECT key FROM settings').all() as { key: string }[]).map((r) => r.key)
  expect(keys).toEqual(['churchName'])
})

test('objetos aninhados são substituídos inteiros, sem merge profundo', () => {
  repo.update({ style: { ...DEFAULT_SETTINGS.style, color: '#FF0000', align: 'left' } })
  const next = repo.update({ background: { type: 'image', color: '#000000', mediaId: 'm1' } as any })
  expect(next.background).toEqual({ type: 'image', color: '#000000', mediaId: 'm1' })
  expect(next.style).toEqual({ ...DEFAULT_SETTINGS.style, color: '#FF0000', align: 'left' })
})

test('unsubscribe de onChange interrompe as notificações', () => {
  const cb = vi.fn()
  const off = repo.onChange(cb)
  off()
  repo.update({ churchName: 'Z' })
  expect(cb).not.toHaveBeenCalled()
})
