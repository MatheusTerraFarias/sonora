import AdmZip from 'adm-zip'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import type { Db } from './db/database'

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`Arquivo de backup inválido: ${reason}`)
    this.name = 'InvalidBackupError'
  }
}

export interface BackupManifest {
  app: 'sonora'
  version: string
  createdAt: string
}

const DB_FILE = 'sonora.db'
const DIRS = ['media', 'bible'] as const

/** Gera o `.sonora` (zip) com cópia consistente do banco, `media/`, `bible/` e `manifest.json`. */
export async function exportBackup(db: Db, dataDir: string, target: string, version = '0.0.0'): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), 'sonora-export-'))
  try {
    const dbCopy = join(tmp, DB_FILE)
    await db.backup(dbCopy)
    const zip = new AdmZip()
    const manifest: BackupManifest = { app: 'sonora', version, createdAt: new Date().toISOString() }
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
    zip.addLocalFile(dbCopy)
    for (const d of DIRS) {
      const p = join(dataDir, d)
      if (existsSync(p)) zip.addLocalFolder(p, d)
    }
    mkdirSync(dirname(target), { recursive: true })
    zip.writeZip(target)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function unsafeName(name: string): boolean {
  const n = name.split(String.fromCharCode(92)).join('/')
  return isAbsolute(n) || n.startsWith('/') || /^[a-zA-Z]:/.test(n) || n.split('/').includes('..')
}

function readZip(file: string): AdmZip {
  try {
    return new AdmZip(file)
  } catch {
    throw new InvalidBackupError('não é um arquivo .sonora')
  }
}

/**
 * Valida o backup (manifest, sonora.db, caminhos seguros) e extrai para uma pasta temporária
 * ao lado de `dataDir`. Só então chama `beforeSwap` (ex.: fechar o banco) e troca banco,
 * `media/` e `bible/`. Entradas inválidas lançam `InvalidBackupError` sem tocar em `dataDir`.
 */
export async function restoreBackup(
  file: string,
  dataDir: string,
  opts: { beforeSwap?: () => void } = {}
): Promise<void> {
  const zip = readZip(file)
  const entries = zip.getEntries()
  for (const e of entries) if (unsafeName(e.entryName)) throw new InvalidBackupError('caminho inseguro no arquivo')
  const manifestEntry = entries.find((e) => e.entryName === 'manifest.json')
  if (!manifestEntry) throw new InvalidBackupError('manifest ausente')
  let manifest: Partial<BackupManifest>
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf8'))
  } catch {
    throw new InvalidBackupError('manifest ilegível')
  }
  if (!manifest || manifest.app !== 'sonora') throw new InvalidBackupError('não é um backup do Sonora')
  if (!entries.some((e) => e.entryName === DB_FILE && !e.isDirectory)) throw new InvalidBackupError('banco ausente')

  mkdirSync(dataDir, { recursive: true })
  const stage = mkdtempSync(join(dataDir, '.restore-'))
  const old = join(stage, '_old')
  try {
    const root = resolve(stage, 'new')
    mkdirSync(root, { recursive: true })
    for (const e of entries) {
      const top = e.entryName.split(String.fromCharCode(92)).join('/').split('/')[0]
      if (e.entryName === 'manifest.json' || (e.entryName !== DB_FILE && !(DIRS as readonly string[]).includes(top))) continue
      const dest = resolve(root, normalize(e.entryName))
      if (dest !== root && !dest.startsWith(root + sep)) throw new InvalidBackupError('caminho inseguro no arquivo')
      if (e.isDirectory) {
        mkdirSync(dest, { recursive: true })
      } else {
        mkdirSync(dirname(dest), { recursive: true })
        writeFileSync(dest, e.getData())
      }
    }
    opts.beforeSwap?.()
    mkdirSync(old, { recursive: true })
    const names = [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, ...DIRS]
    const moved: string[] = []
    try {
      for (const n of names) {
        if (existsSync(join(dataDir, n))) {
          renameSync(join(dataDir, n), join(old, n))
          moved.push(n)
        }
      }
      for (const n of readdirSync(root)) renameSync(join(root, n), join(dataDir, n))
    } catch (err) {
      // desfaz: devolve o que foi movido para o lugar
      for (const n of [DB_FILE, ...DIRS]) {
        if (existsSync(join(dataDir, n)) && !moved.includes(n)) rmSync(join(dataDir, n), { recursive: true, force: true })
      }
      for (const n of moved) {
        rmSync(join(dataDir, n), { recursive: true, force: true })
        renameSync(join(old, n), join(dataDir, n))
      }
      throw err
    }
  } finally {
    rmSync(stage, { recursive: true, force: true })
  }
}
