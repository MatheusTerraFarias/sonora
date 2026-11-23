import { randomUUID } from 'node:crypto'
import type { Db } from '../db/database'

export interface YoutubeFavorite {
  videoId: string
  title: string
  channel: string
  thumbnail: string
}

interface Row {
  video_id: string
  title: string
  channel: string
  thumbnail: string
}

export function createFavoritesRepo(db: Db) {
  return {
    list(): YoutubeFavorite[] {
      const rows = db.prepare('SELECT video_id, title, channel, thumbnail FROM youtube_favorites ORDER BY created_at, rowid').all() as Row[]
      return rows.map((r) => ({ videoId: r.video_id, title: r.title, channel: r.channel, thumbnail: r.thumbnail }))
    },

    /** adicionar um vídeo já favoritado mantém o existente */
    add(v: YoutubeFavorite): void {
      const now = new Date().toISOString()
      db.prepare(
        'INSERT OR IGNORE INTO youtube_favorites(id, video_id, title, channel, thumbnail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), v.videoId, v.title, v.channel, v.thumbnail, now, now)
    },

    remove(videoId: string): void {
      db.prepare('DELETE FROM youtube_favorites WHERE video_id = ?').run(videoId)
    }
  }
}

export type FavoritesRepo = ReturnType<typeof createFavoritesRepo>
