import { afterEach, beforeEach, expect, test } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, type Db } from '../../../src/main/db/database'
import { createMediaRepo, UnsupportedMediaError } from '../../../src/main/repos/media'

let db: Db
let tmp: string
let mediaDir: string
let repo: ReturnType<typeof createMediaRepo>

const fake = (name: string): string => {
  const p = join(tmp, name)
  writeFileSync(p, 'fake')
  return p
}

beforeEach(() => {
  db = openDatabase(':memory:')
  tmp = mkdtempSync(join(tmpdir(), 'sonora-media-'))
  mediaDir = join(tmp, 'media')
  repo = createMediaRepo(db, mediaDir)
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

test('importa vídeo: copia para mediaDir e independe do original', () => {
  const src = fake('Culto.MP4')
  const m = repo.importFile(src)
  expect(m.kind).toBe('video')
  expect(m.mime).toBe('video/mp4')
  expect(m.originalName).toBe('Culto.MP4')
  expect(m.fileName).toMatch(/\.mp4$/)
  const p = repo.filePath(m.id)!
  expect(p.startsWith(mediaDir)).toBe(true)
  expect(existsSync(p)).toBe(true)
  rmSync(src)
  expect(existsSync(p)).toBe(true)
})

test('detecta imagem e áudio; list filtra por kind', () => {
  repo.importFile(fake('a.png'))
  repo.importFile(fake('b.mp3'))
  expect(repo.list().length).toBe(2)
  expect(repo.list('image').map((m) => m.kind)).toEqual(['image'])
  expect(repo.list('audio')[0].mime).toBe('audio/mpeg')
})

test('extensão desconhecida lança UnsupportedMediaError', () => {
  expect(() => repo.importFile(fake('x.exe'))).toThrow(UnsupportedMediaError)
  expect(repo.list()).toEqual([])
})

test('remove apaga registro e arquivo', () => {
  const m = repo.importFile(fake('a.jpg'))
  const p = repo.filePath(m.id)!
  repo.remove(m.id)
  expect(existsSync(p)).toBe(false)
  expect(repo.list()).toEqual([])
  expect(repo.filePath(m.id)).toBeNull()
  expect(() => repo.remove(m.id)).not.toThrow()
})
