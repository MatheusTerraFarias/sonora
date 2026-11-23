import AdmZip from 'adm-zip'
import Database from 'better-sqlite3'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readdirSync, readSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import type { Db } from './db/database'

/** prefixo reconhecível no renderer (o IPC perde a classe do erro) */
export const INVALID_PREFIX = 'INVALID_BACKUP:'
export const RESTORE_FAILED_PREFIX = 'RESTORE_FAILED:'

export class InvalidBackupError extends Error {
  constructor(reason: string) {
    super(`${INVALID_PREFIX} ${reason}`)
    this.name = 'InvalidBackupError'
  }
}

export interface BackupManifest {
  app: 'sonora'
  version: string
  createdAt: string
}

const STAGE_PREFIX = '.restore-stage-'
const OLD_PREFIX = '.restore-old-'
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
    const partial = `${target}.tmp`
    zip.writeZip(partial)
    renameSync(partial, target)
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

const SQLITE_MAGIC = 'SQLite format 3\0'

/** confere cabeçalho e integridade do banco extraído; lança InvalidBackupError */
function assertValidDb(path: string): void {
  const buf = Buffer.alloc(16)
  const fd = openSync(path, 'r')
  try {
    readSync(fd, buf, 0, 16, 0)
  } finally {
    closeSync(fd)
  }
  if (buf.toString('latin1') !== SQLITE_MAGIC) throw new InvalidBackupError('banco corrompido')
  let ok = false
  try {
    const d = new Database(path, { readonly: true })
    try {
      ok = d.pragma('quick_check', { simple: true }) === 'ok'
    } finally {
      d.close()
    }
  } catch {
    ok = false
  }
  if (!ok) throw new InvalidBackupError('banco corrompido')
}

export interface RestoreOptions {
  /** chamado após validar tudo e antes de mexer nos dados (ex.: fechar o banco) */
  beforeSwap?: () => void
  /** injetável nos testes para simular falhas */
  rename?: (from: string, to: string) => void
  now?: () => number
}

/**
 * Valida o backup (manifest, sonora.db, caminhos seguros, integridade do banco) e extrai para uma
 * pasta de preparo dentro de `dataDir`. Só então chama `beforeSwap` e troca banco, `media/` e `bible/`.
 * Backup inválido lança `InvalidBackupError` sem tocar em `dataDir`. Os dados antigos ficam em
 * `.restore-old-<ts>` até a próxima inicialização bem-sucedida (`cleanupRestoreLeftovers`).
 * Falha na troca desfaz só o que esta execução colocou; se o desfazer falhar, a pasta de preparo
 * (com os dados originais) é mantida e o erro informa o caminho.
 */
export async function restoreBackup(file: string, dataDir: string, opts: RestoreOptions = {}): Promise<void> {
  const rename = opts.rename ?? renameSync
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
  const stage = mkdtempSync(join(dataDir, STAGE_PREFIX))
  const old = join(stage, '_old')
  const root = resolve(stage, 'new')
  let keepStage = false
  try {
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
    assertValidDb(join(root, DB_FILE))
    opts.beforeSwap?.()
    mkdirSync(old, { recursive: true })
    const moved: string[] = []
    const placed: string[] = []
    try {
      for (const n of [DB_FILE, `${DB_FILE}-wal`, `${DB_FILE}-shm`, ...DIRS]) {
        if (existsSync(join(dataDir, n))) {
          rename(join(dataDir, n), join(old, n))
          moved.push(n)
        }
      }
      // só o banco e as pastas: a validação pode ter criado -wal/-shm no preparo
      for (const n of readdirSync(root).filter((x) => x === DB_FILE || (DIRS as readonly string[]).includes(x))) {
        rename(join(root, n), join(dataDir, n))
        placed.push(n)
      }
    } catch (err) {
      try {
        // remove só o que esta execução colocou; nunca algo que ela não colocou
        for (const n of placed) rmSync(join(dataDir, n), { recursive: true, force: true })
        for (const n of moved) rename(join(old, n), join(dataDir, n))
      } catch (rollbackErr) {
        keepStage = true
        throw new Error(`${RESTORE_FAILED_PREFIX} falha ao desfazer a troca; os dados originais estão em ${old}`, {
          cause: rollbackErr
        })
      }
      throw new Error(`${RESTORE_FAILED_PREFIX} ${(err as Error).message}`, { cause: err })
    }
    // sucesso: guarda os dados antigos até o próximo início bem-sucedido
    try {
      rename(old, join(dataDir, `${OLD_PREFIX}${(opts.now ?? Date.now)()}`))
    } catch {
      keepStage = true
    }
  } finally {
    if (!keepStage) rmSync(stage, { recursive: true, force: true })
  }
}

/**
 * Chamar após abrir o banco com sucesso: apaga `.restore-old-*` (dados anteriores a uma restauração
 * concluída). Pastas de preparo com `_old` não vazio (queda no meio da troca) NÃO são apagadas:
 * são devolvidas em `stranded` para log e recuperação manual.
 */
export function cleanupRestoreLeftovers(dataDir: string): { removed: string[]; stranded: string[] } {
  const removed: string[] = []
  const stranded: string[] = []
  let names: string[] = []
  try {
    names = readdirSync(dataDir)
  } catch {
    return { removed, stranded }
  }
  for (const n of names) {
    const p = join(dataDir, n)
    if (n.startsWith(OLD_PREFIX)) {
      try {
        rmSync(p, { recursive: true, force: true })
        removed.push(p)
      } catch {
        // tenta de novo na próxima inicialização
      }
    } else if (n.startsWith(STAGE_PREFIX)) {
      const oldDir = join(p, '_old')
      if (existsSync(oldDir) && readdirSync(oldDir).length > 0) {
        stranded.push(p)
      } else {
        try {
          rmSync(p, { recursive: true, force: true })
          removed.push(p)
        } catch {
          // ignorado
        }
      }
    }
  }
  return { removed, stranded }
}
