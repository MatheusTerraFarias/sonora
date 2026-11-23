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

// ---- caminhos arriscados da restauração ----
import { cpSync, readdirSync } from 'node:fs'
import { renameSync } from 'node:fs'
import { cleanupRestoreLeftovers } from '../../src/main/backup'

async function makeBackup(): Promise<string> {
  const target = join(root, 'ok.sonora')
  await exportBackup(db, srcDir, target)
  return target
}

function seedDst(): void {
  const d = openDatabase(join(dstDir, 'sonora.db'))
  createSongsRepo(d).create({ title: 'Original', artist: 'A', key: null, tags: [], lyrics: 'x', attachment: { kind: 'none' } } as never)
  d.close()
  mkdirSync(join(dstDir, 'media'), { recursive: true })
  mkdirSync(join(dstDir, 'bible'), { recursive: true })
  writeFileSync(join(dstDir, 'media', 'orig.png'), 'orig')
  writeFileSync(join(dstDir, 'bible', 'orig.json'), 'orig-bible')
}

function expectOriginalIntact(): void {
  expect(readFileSync(join(dstDir, 'media', 'orig.png'), 'utf8')).toBe('orig')
  expect(readFileSync(join(dstDir, 'bible', 'orig.json'), 'utf8')).toBe('orig-bible')
  const d = openDatabase(join(dstDir, 'sonora.db'))
  try {
    expect(createSongsRepo(d).list().map((s) => s.title)).toEqual(['Original'])
  } finally {
    d.close()
  }
}

const eperm = (): Error => Object.assign(new Error('EPERM'), { code: 'EPERM' })

test('rename de media/ para _old falha: nada do original é apagado', async () => {
  seedDst()
  const file = await makeBackup()
  const rename = (a: string, b: string): void => {
    if (a.endsWith('media') && b.includes('_old')) throw eperm()
    renameSync(a, b)
  }
  await expect(restoreBackup(file, dstDir, { rename })).rejects.toThrow(/RESTORE_FAILED:/)
  expectOriginalIntact()
})

test('falha ao colocar o novo item desfaz a troca e preserva o original', async () => {
  seedDst()
  const file = await makeBackup()
  const rename = (a: string, b: string): void => {
    if (a.includes(`${'new'}`) && a.endsWith('media')) throw eperm()
    renameSync(a, b)
  }
  await expect(restoreBackup(file, dstDir, { rename })).rejects.toThrow(/RESTORE_FAILED:/)
  expectOriginalIntact()
  expect(readdirSync(dstDir).filter((n) => n.startsWith('.restore-'))).toEqual([])
})

test('falha no desfazer mantém a pasta de preparo e informa o caminho dos dados originais', async () => {
  seedDst()
  const file = await makeBackup()
  const rename = (a: string, b: string): void => {
    if (a.endsWith('media') && a.includes('new')) throw eperm()
    if (a.includes('_old') && a.endsWith('bible')) throw eperm()
    renameSync(a, b)
  }
  const err = await restoreBackup(file, dstDir, { rename }).catch((e: Error) => e)
  expect(err).toBeInstanceOf(Error)
  expect((err as Error).message).toMatch(/_old/)
  const stage = readdirSync(dstDir).find((n) => n.startsWith('.restore-stage-'))!
  expect(readFileSync(join(dstDir, stage, '_old', 'bible', 'orig.json'), 'utf8')).toBe('orig-bible')
  expect(cleanupRestoreLeftovers(dstDir).stranded.length).toBe(1)
  expect(existsSync(join(dstDir, stage))).toBe(true)
})

test('beforeSwap que lança não altera os dados', async () => {
  seedDst()
  const file = await makeBackup()
  await expect(
    restoreBackup(file, dstDir, {
      beforeSwap: () => {
        throw new Error('boom')
      }
    })
  ).rejects.toThrow('boom')
  expectOriginalIntact()
  expect(readdirSync(dstDir).filter((n) => n.startsWith('.restore-'))).toEqual([])
})

test('substitui sonora.db existente e remove -wal/-shm antigos', async () => {
  seedDst()
  writeFileSync(join(dstDir, 'sonora.db-wal'), 'wal')
  writeFileSync(join(dstDir, 'sonora.db-shm'), 'shm')
  const file = await makeBackup()
  await restoreBackup(file, dstDir)
  expect(existsSync(join(dstDir, 'sonora.db-wal'))).toBe(false)
  expect(existsSync(join(dstDir, 'sonora.db-shm'))).toBe(false)
  const d = openDatabase(join(dstDir, 'sonora.db'))
  try {
    expect(createSongsRepo(d).list().map((s) => s.title)).toEqual(['Grande é o Senhor'])
  } finally {
    d.close()
  }
})

test('backup sem media/ e bible/ restaura só o banco', async () => {
  rmSync(join(srcDir, 'media'), { recursive: true })
  rmSync(join(srcDir, 'bible'), { recursive: true })
  const file = await makeBackup()
  await restoreBackup(file, dstDir)
  expect(existsSync(join(dstDir, 'sonora.db'))).toBe(true)
})

test('sonora.db corrompido lança InvalidBackupError e nada muda', async () => {
  seedDst()
  for (const bad of [Buffer.from('isto nao e sqlite'), Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(200, 7)])]) {
    const zip = new AdmZip()
    zip.addFile('manifest.json', Buffer.from(JSON.stringify({ app: 'sonora', version: '1', createdAt: 'x' })))
    zip.addFile('sonora.db', bad)
    const f = join(root, 'corrupt.sonora')
    zip.writeZip(f)
    let called = false
    const err = await restoreBackup(f, dstDir, { beforeSwap: () => void (called = true) }).catch((e: Error) => e)
    expect(err).toBeInstanceOf(InvalidBackupError)
    expect((err as Error).message).toMatch(/^INVALID_BACKUP:/)
    expect(called).toBe(false)
    expectOriginalIntact()
    expect(readdirSync(dstDir).filter((n) => n.startsWith('.restore-'))).toEqual([])
  }
})

test('após sucesso os dados antigos ficam em .restore-old-* e cleanupRestoreLeftovers os apaga', async () => {
  seedDst()
  const file = await makeBackup()
  await restoreBackup(file, dstDir, { now: () => 123 })
  const old = join(dstDir, '.restore-old-123')
  expect(readFileSync(join(old, 'media', 'orig.png'), 'utf8')).toBe('orig')
  expect(readdirSync(dstDir).filter((n) => n.startsWith('.restore-stage-'))).toEqual([])
  const r = cleanupRestoreLeftovers(dstDir)
  expect(r.removed).toEqual([old])
  expect(existsSync(old)).toBe(false)
  expect(existsSync(join(dstDir, 'media', 'a.png'))).toBe(true)
})

test('exportBackup não deixa .tmp', async () => {
  const f = await makeBackup()
  expect(existsSync(f)).toBe(true)
  expect(existsSync(`${f}.tmp`)).toBe(false)
  cpSync(f, join(root, 'copy.sonora'))
})
