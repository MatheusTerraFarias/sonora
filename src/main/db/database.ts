import Database from 'better-sqlite3'
import { migrations } from './migrations'

export type Db = Database.Database

export function openDatabase(file: string): Db {
  const db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_version').all() as { version: number }[]).map((r) => r.version)
  )
  const record = db.prepare('INSERT INTO schema_version(version, applied_at) VALUES (?, ?)')
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (applied.has(m.version)) continue
    db.transaction(() => {
      db.exec(m.sql)
      record.run(m.version, new Date().toISOString())
    })()
  }
  return db
}
