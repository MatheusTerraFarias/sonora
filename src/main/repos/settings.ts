import type { Db } from '../db/database'
import type { Settings } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/defaults'

const KEYS = new Set<string>(Object.keys(DEFAULT_SETTINGS))

export function createSettingsRepo(db: Db) {
  const listeners = new Set<(s: Settings) => void>()
  const readAll = db.prepare('SELECT key, value FROM settings')
  const write = db.prepare(
    'INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )

  function get(): Settings {
    const merged = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>
    for (const row of readAll.all() as { key: string; value: string }[]) {
      if (!KEYS.has(row.key)) continue
      try {
        merged[row.key] = JSON.parse(row.value)
      } catch {
        // valor corrompido: mantém o padrão para não impedir a abertura do app
      }
    }
    return merged as unknown as Settings
  }

  return {
    get,

    /** grava só as chaves do patch; objetos aninhados são substituídos inteiros */
    update(patch: Partial<Settings>): Settings {
      const entries = Object.entries(patch).filter(([k, v]) => KEYS.has(k) && v !== undefined)
      db.transaction(() => {
        for (const [k, v] of entries) write.run(k, JSON.stringify(v))
      })()
      const next = get()
      for (const cb of listeners) cb(structuredClone(next))
      return next
    },

    onChange(cb: (s: Settings) => void): () => void {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    }
  }
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>
