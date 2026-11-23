import { randomUUID } from 'node:crypto'
import type { ID, Song, SongAttachment, SongPart } from '../../shared/types'
import { parseLyrics } from '../../shared/lyrics'
import type { Db } from '../db/database'

export interface SongInput {
  title: string
  artist: string
  key: string | null
  tags: string[]
  lyrics: string
  attachment: SongAttachment
}

interface SongRow {
  id: string
  title: string
  artist: string
  song_key: string
  tags: string
  arrangement: string
  attachment: string | null
  created_at: string
  updated_at: string
}

/** minúsculas e sem acentos */
export function foldText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function searchText(title: string, artist: string, parts: { slides: string[] }[]): string {
  return foldText([title, artist, ...parts.flatMap((p) => p.slides)].join('\n'))
}

export function createSongsRepo(db: Db) {
  const insertPart = db.prepare('INSERT INTO song_parts(id, song_id, label, slides, position) VALUES (?, ?, ?, ?, ?)')
  const partsOf = db.prepare('SELECT id, label, slides FROM song_parts WHERE song_id = ? ORDER BY position')

  function load(row: SongRow): Song {
    const parts = (partsOf.all(row.id) as { id: string; label: string; slides: string }[]).map(
      (p): SongPart => ({ id: p.id, label: p.label, slides: JSON.parse(p.slides) })
    )
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      key: row.song_key === '' ? null : row.song_key,
      tags: JSON.parse(row.tags),
      parts,
      arrangement: JSON.parse(row.arrangement),
      attachment: row.attachment ? JSON.parse(row.attachment) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  function get(id: ID): Song | null {
    const row = db.prepare('SELECT * FROM songs WHERE id = ?').get(id) as SongRow | undefined
    return row ? load(row) : null
  }

  function writeParts(songId: ID, lyrics: string): { parts: SongPart[]; arrangement: ID[] } {
    const parsed = parseLyrics(lyrics)
    const parts = parsed.parts.map((p): SongPart => ({ id: randomUUID(), ...p }))
    parts.forEach((p, i) => insertPart.run(p.id, songId, p.label, JSON.stringify(p.slides), i))
    return { parts, arrangement: parsed.arrangement.map((i) => parts[i].id) }
  }

  const attachmentJson = (a: SongAttachment): string | null => (a ? JSON.stringify(a) : null)

  return {
    list(query?: string): Song[] {
      const q = query ? foldText(query.trim()) : ''
      const rows = (
        q
          ? db
              .prepare("SELECT * FROM songs WHERE search_text LIKE ? ESCAPE '\\' ORDER BY title COLLATE NOCASE")
              .all(`%${q.replace(/[\\%_]/g, '\\$&')}%`)
          : db.prepare('SELECT * FROM songs ORDER BY title COLLATE NOCASE').all()
      ) as SongRow[]
      return rows.map(load)
    },

    get,

    create(input: SongInput): Song {
      const id = randomUUID()
      const now = new Date().toISOString()
      db.transaction(() => {
        db.prepare(
          `INSERT INTO songs(id, title, artist, song_key, tags, arrangement, attachment, search_text, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '[]', ?, '', ?, ?)`
        ).run(id, input.title, input.artist, input.key ?? '', JSON.stringify(input.tags), attachmentJson(input.attachment), now, now)
        const { parts, arrangement } = writeParts(id, input.lyrics)
        db.prepare('UPDATE songs SET arrangement = ?, search_text = ? WHERE id = ?').run(
          JSON.stringify(arrangement),
          searchText(input.title, input.artist, parts),
          id
        )
      })()
      return get(id)!
    },

    update(id: ID, input: SongInput): Song {
      db.transaction(() => {
        if (!get(id)) throw new Error(`Música não encontrada: ${id}`)
        db.prepare('DELETE FROM song_parts WHERE song_id = ?').run(id)
        const { parts, arrangement } = writeParts(id, input.lyrics)
        db.prepare(
          `UPDATE songs SET title = ?, artist = ?, song_key = ?, tags = ?, arrangement = ?, attachment = ?, search_text = ?, updated_at = ? WHERE id = ?`
        ).run(
          input.title,
          input.artist,
          input.key ?? '',
          JSON.stringify(input.tags),
          JSON.stringify(arrangement),
          attachmentJson(input.attachment),
          searchText(input.title, input.artist, parts),
          new Date().toISOString(),
          id
        )
      })()
      return get(id)!
    },

    setArrangement(id: ID, arrangement: ID[]): Song {
      const r = db
        .prepare('UPDATE songs SET arrangement = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(arrangement), new Date().toISOString(), id)
      if (r.changes === 0) throw new Error(`Música não encontrada: ${id}`)
      return get(id)!
    },

    remove(id: ID): void {
      db.prepare('DELETE FROM songs WHERE id = ?').run(id)
    }
  }
}

export type SongsRepo = ReturnType<typeof createSongsRepo>
