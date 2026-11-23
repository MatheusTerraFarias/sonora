import { afterEach, beforeEach, expect, test } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { openDatabase, type Db } from '../../src/main/db/database'
import { createSongsRepo } from '../../src/main/repos/songs'
import { exportBackup, restoreBackup, InvalidBackupError } from '../../src/main/backup'

let root: string
let srcDir: string
let dstDir: string
let db: Db

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sonora-backup-'))
  srcDir = join(root, 'src')
  dstDir = join(root, 'dst')
  mkdirSync(join(srcDir, 'media'), { recursive: true })
  mkdirSync(join(srcDir, 'bible'), { recursive: true })
  mkdirSync(dstDir, { recursive: true })
  db = openDatabase(join(srcDir, 'sonora.db'))
  createSongsRepo(db).create({ title: 'Grande é o Senhor', artist: 'A', key: null, tags: [], lyrics: '[Refrão]\nGrande', attachment: { kind: 'none' } } as never)
  writeFileSync(join(srcDir, 'media', 'a.png'), 'png-bytes')
  writeFileSync(join(srcDir, 'bible', 'x.json'), '{"id":"x"}')
})

afterEach(() => {
  db.close()
  rmSync(root, { recursive: true, force: true })
})

test('exportar e restaurar em outra pasta reproduz músicas, mídias e bíblias', async () => {
  const target = join(root, 'b.sonora')
  await exportBackup(db, srcDir, target)
  const names = new AdmZip(target).getEntries().map((e) => e.entryName)
  expect(names).toEqual(expect.arrayContaining(['manifest.json', 'sonora.db', 'media/a.png', 'bible/x.json']))
  await restoreBackup(target, dstDir)
  expect(readFileSync(join(dstDir, 'media', 'a.png'), 'utf8')).toBe('png-bytes')
  expect(readFileSync(join(dstDir, 'bible', 'x.json'), 'utf8')).toBe('{"id":"x"}')
  const restored = openDatabase(join(dstDir, 'sonora.db'))
  try {
    expect(createSongsRepo(restored).list().map((s) => s.title)).toEqual(['Grande é o Senhor'])
  } finally {
    restored.close()
  }
})

test('restaurar substitui os dados existentes e chama beforeSwap só após validar', async () => {
  const target = join(root, 'b.sonora')
  await exportBackup(db, srcDir, target)
  mkdirSync(join(dstDir, 'media'), { recursive: true })
  writeFileSync(join(dstDir, 'media', 'velho.png'), 'velho')
  let called = 0
  await restoreBackup(target, dstDir, { beforeSwap: () => void called++ })
  expect(called).toBe(1)
  expect(existsSync(join(dstDir, 'media', 'velho.png'))).toBe(false)
  expect(existsSync(join(dstDir, 'media', 'a.png'))).toBe(true)
})

function expectUntouched(): void {
  expect(readFileSync(join(dstDir, 'keep.txt'), 'utf8')).toBe('intacto')
}

test('zip sem manifest lança InvalidBackupError e não altera o destino', async () => {
  writeFileSync(join(dstDir, 'keep.txt'), 'intacto')
  const zip = new AdmZip()
  zip.addFile('sonora.db', Buffer.from('x'))
  const file = join(root, 'bad.sonora')
  zip.writeZip(file)
  let called = false
  await expect(restoreBackup(file, dstDir, { beforeSwap: () => void (called = true) })).rejects.toBeInstanceOf(InvalidBackupError)
  expect(called).toBe(false)
  expectUntouched()
  expect(existsSync(join(dstDir, 'sonora.db'))).toBe(false)
})

test('arquivo que não é zip, manifest de outro app ou sem sonora.db é inválido', async () => {
  writeFileSync(join(dstDir, 'keep.txt'), 'intacto')
  const notZip = join(root, 'n.sonora')
  writeFileSync(notZip, 'lixo')
  await expect(restoreBackup(notZip, dstDir)).rejects.toBeInstanceOf(InvalidBackupError)
  const other = new AdmZip()
  other.addFile('manifest.json', Buffer.from(JSON.stringify({ app: 'outro', version: '1', createdAt: 'x' })))
  other.addFile('sonora.db', Buffer.from('x'))
  other.writeZip(join(root, 'o.sonora'))
  await expect(restoreBackup(join(root, 'o.sonora'), dstDir)).rejects.toBeInstanceOf(InvalidBackupError)
  const noDb = new AdmZip()
  noDb.addFile('manifest.json', Buffer.from(JSON.stringify({ app: 'sonora', version: '1', createdAt: 'x' })))
  noDb.writeZip(join(root, 'nd.sonora'))
  await expect(restoreBackup(join(root, 'nd.sonora'), dstDir)).rejects.toBeInstanceOf(InvalidBackupError)
  expectUntouched()
})

test('entradas com ".." ou caminho absoluto (zip-slip) são rejeitadas sem escrever fora', async () => {
  writeFileSync(join(dstDir, 'keep.txt'), 'intacto')
  for (const evil of ['../evil.txt', 'media/../../evil.txt', '/abs-evil.txt', 'C:/abs-evil.txt']) {
    const zip = new AdmZip()
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ app: 'sonora', version: '1', createdAt: 'x' })))
    zip.addFile('sonora.db', Buffer.from('x'))
    // adm-zip normaliza em addFile; força o nome após a criação
    zip.addFile('placeholder.txt', Buffer.from('mal'))
    zip.getEntries().find((e) => e.entryName === 'placeholder.txt')!.entryName = evil
    const file = join(root, 'evil.sonora')
    zip.writeZip(file)
    await expect(restoreBackup(file, dstDir)).rejects.toBeInstanceOf(InvalidBackupError)
  }
  expect(existsSync(join(root, 'evil.txt'))).toBe(false)
  expectUntouched()
  expect(existsSync(join(dstDir, 'sonora.db'))).toBe(false)
})
