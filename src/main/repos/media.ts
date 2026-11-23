import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { ID, MediaItem, MediaKind } from '../../shared/types'
import type { Db } from '../db/database'

export class UnsupportedMediaError extends Error {
  constructor(public readonly extension: string) {
    super(`Tipo de mídia não suportado: ${extension || '(sem extensão)'}`)
    this.name = 'UnsupportedMediaError'
  }
}

const TYPES: Record<string, { kind: MediaKind; mime: string }> = {
  '.png': { kind: 'image', mime: 'image/png' },
  '.jpg': { kind: 'image', mime: 'image/jpeg' },
  '.jpeg': { kind: 'image', mime: 'image/jpeg' },
  '.webp': { kind: 'image', mime: 'image/webp' },
  '.gif': { kind: 'image', mime: 'image/gif' },
  '.mp4': { kind: 'video', mime: 'video/mp4' },
  '.webm': { kind: 'video', mime: 'video/webm' },
  '.mov': { kind: 'video', mime: 'video/quicktime' },
  '.mkv': { kind: 'video', mime: 'video/x-matroska' },
  '.mp3': { kind: 'audio', mime: 'audio/mpeg' },
  '.wav': { kind: 'audio', mime: 'audio/wav' },
  '.ogg': { kind: 'audio', mime: 'audio/ogg' },
  '.m4a': { kind: 'audio', mime: 'audio/mp4' },
  '.aac': { kind: 'audio', mime: 'audio/aac' }
}

/** extensões aceitas (sem o ponto), para filtros de diálogo */
export const MEDIA_EXTENSIONS = Object.keys(TYPES).map((e) => e.slice(1))

interface MediaRow {
  id: string
  kind: MediaKind
  original_name: string
  file_name: string
  mime: string
}

const toItem = (r: MediaRow): MediaItem => ({
  id: r.id,
  kind: r.kind,
  originalName: r.original_name,
  fileName: r.file_name,
  mime: r.mime
})

export function createMediaRepo(db: Db, mediaDir: string) {
  return {
    list(kind?: MediaKind): MediaItem[] {
      const rows = (
        kind
          ? db.prepare('SELECT * FROM media WHERE kind = ? ORDER BY created_at, rowid').all(kind)
          : db.prepare('SELECT * FROM media ORDER BY created_at, rowid').all()
      ) as MediaRow[]
      return rows.map(toItem)
    },

    get(id: ID): MediaItem | null {
      const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRow | undefined
      return row ? toItem(row) : null
    },

    importFile(path: string): MediaItem {
      const ext = extname(path).toLowerCase()
      const type = TYPES[ext]
      if (!type) throw new UnsupportedMediaError(ext)
      mkdirSync(mediaDir, { recursive: true })
      const id = randomUUID()
      const fileName = `${id}${ext}`
      copyFileSync(path, join(mediaDir, fileName))
      const now = new Date().toISOString()
      try {
        db.prepare(
          'INSERT INTO media(id, kind, original_name, file_name, mime, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(id, type.kind, basename(path), fileName, type.mime, now, now)
      } catch (e) {
        rmSync(join(mediaDir, fileName), { force: true })
        throw e
      }
      return { id, kind: type.kind, originalName: basename(path), fileName, mime: type.mime }
    },

    remove(id: ID): void {
      const row = db.prepare('SELECT file_name FROM media WHERE id = ?').get(id) as { file_name: string } | undefined
      if (!row) return
      db.prepare('DELETE FROM media WHERE id = ?').run(id)
      rmSync(join(mediaDir, row.file_name), { force: true })
    },

    filePath(id: ID): string | null {
      const row = db.prepare('SELECT file_name FROM media WHERE id = ?').get(id) as { file_name: string } | undefined
      return row ? join(mediaDir, row.file_name) : null
    }
  }
}

export type MediaRepo = ReturnType<typeof createMediaRepo>
