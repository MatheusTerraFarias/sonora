import { randomUUID } from 'node:crypto'
import type { ID, MediaItem, ResolvedItem, Service, ServiceItem, ServiceItemData, Song } from '../../shared/types'
import type { Db } from '../db/database'
import { strings } from '../strings'

interface ServiceRow {
  id: string
  name: string
  date: string
}

interface ItemRow {
  id: string
  service_id: string
  position: number
  data: string
}

const KINDS = ['song', 'bible', 'media', 'youtube', 'notice']

/** dado ilegível vira referência a uma música inexistente, que resolve como "Item removido" */
const CORRUPT_DATA: ServiceItemData = { kind: 'song', songId: '' }

const parseData = (raw: string): ServiceItemData => {
  try {
    const d = JSON.parse(raw)
    return d && typeof d === 'object' && KINDS.includes(d.kind) ? (d as ServiceItemData) : CORRUPT_DATA
  } catch {
    return CORRUPT_DATA
  }
}

const toItem = (r: ItemRow): ServiceItem => ({
  id: r.id,
  serviceId: r.service_id,
  position: r.position,
  data: parseData(r.data)
})

const refIdOf = (data: ServiceItemData): string | null =>
  data.kind === 'song' ? data.songId : data.kind === 'media' ? data.mediaId : null

export function createServicesRepo(db: Db) {
  const items = (serviceId: ID): ServiceItem[] =>
    (
      db
        .prepare('SELECT id, service_id, position, data FROM service_items WHERE service_id = ? ORDER BY position, rowid')
        .all(serviceId) as ItemRow[]
    ).map(toItem)

  const get = (id: ID): Service | null => {
    const row = db.prepare('SELECT id, name, date FROM services WHERE id = ?').get(id) as ServiceRow | undefined
    return row ? { id: row.id, name: row.name, date: row.date, items: items(id) } : null
  }

  const mustGet = (id: ID): Service => {
    const s = get(id)
    if (!s) throw new Error(`Culto não encontrado: ${id}`)
    return s
  }

  const itemRow = (itemId: ID): ItemRow => {
    const row = db.prepare('SELECT id, service_id, position, data FROM service_items WHERE id = ?').get(itemId) as ItemRow | undefined
    if (!row) throw new Error(`Item não encontrado: ${itemId}`)
    return row
  }

  /** regrava as posições 0..n-1 na ordem dada */
  const writeOrder = (orderedIds: ID[]): void => {
    const stmt = db.prepare('UPDATE service_items SET position = ? WHERE id = ?')
    orderedIds.forEach((id, i) => stmt.run(i, id))
  }

  const insertItem = (serviceId: ID, position: number, data: ServiceItemData): ServiceItem => {
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO service_items(id, service_id, position, kind, ref_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, serviceId, position, data.kind, refIdOf(data), JSON.stringify(data), now, now)
    return { id, serviceId, position, data }
  }

  return {
    list(): Omit<Service, 'items'>[] {
      return db.prepare('SELECT id, name, date FROM services ORDER BY date DESC, created_at DESC, rowid DESC').all() as ServiceRow[]
    },

    get,

    create(name: string, date: string): Service {
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare('INSERT INTO services(id, name, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, name, date, now, now)
      return mustGet(id)
    },

    rename(id: ID, name: string, date: string): Service {
      mustGet(id)
      db.prepare('UPDATE services SET name = ?, date = ?, updated_at = ? WHERE id = ?').run(name, date, new Date().toISOString(), id)
      return mustGet(id)
    },

    duplicate(id: ID, newDate: string): Service {
      const src = mustGet(id)
      const newId = randomUUID()
      db.transaction(() => {
        const now = new Date().toISOString()
        db.prepare('INSERT INTO services(id, name, date, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
          newId,
          src.name,
          newDate,
          now,
          now
        )
        src.items.forEach((it, i) => insertItem(newId, i, it.data))
      })()
      return mustGet(newId)
    },

    remove(id: ID): void {
      db.prepare('DELETE FROM services WHERE id = ?').run(id)
    },

    addItem(serviceId: ID, data: ServiceItemData, position?: number): ServiceItem {
      mustGet(serviceId)
      return db.transaction(() => {
        const ids = items(serviceId).map((i) => i.id)
        const at = position === undefined ? ids.length : Math.max(0, Math.min(position, ids.length))
        const created = insertItem(serviceId, ids.length, data)
        ids.splice(at, 0, created.id)
        writeOrder(ids)
        return { ...created, position: at }
      })()
    },

    updateItem(itemId: ID, data: ServiceItemData): ServiceItem {
      const row = itemRow(itemId)
      db.prepare('UPDATE service_items SET kind = ?, ref_id = ?, data = ?, updated_at = ? WHERE id = ?').run(
        data.kind,
        refIdOf(data),
        JSON.stringify(data),
        new Date().toISOString(),
        itemId
      )
      return { id: itemId, serviceId: row.service_id, position: row.position, data }
    },

    moveItem(itemId: ID, toPosition: number): Service {
      const row = itemRow(itemId)
      db.transaction(() => {
        const ids = items(row.service_id).map((i) => i.id)
        ids.splice(ids.indexOf(itemId), 1)
        ids.splice(Math.max(0, Math.min(toPosition, ids.length)), 0, itemId)
        writeOrder(ids)
      })()
      return mustGet(row.service_id)
    },

    removeItem(itemId: ID): void {
      const row = db.prepare('SELECT service_id FROM service_items WHERE id = ?').get(itemId) as { service_id: string } | undefined
      if (!row) return
      db.transaction(() => {
        db.prepare('DELETE FROM service_items WHERE id = ?').run(itemId)
        writeOrder(items(row.service_id).map((i) => i.id))
      })()
    }
  }
}

export type ServicesRepo = ReturnType<typeof createServicesRepo>

export interface ResolveDeps {
  songs: { get(id: ID): Pick<Song, 'title'> | null }
  media: { get(id: ID): Pick<MediaItem, 'id' | 'originalName'> | null }
}

/** Resolve um item do culto para exibição; `missing` quando a música/mídia referenciada não existe mais. */
export function resolveItem(item: ServiceItem, deps: ResolveDeps): ResolvedItem {
  const d = item.data
  const removed = { item, missing: true, title: strings.services.removedItem }
  switch (d.kind) {
    case 'song': {
      const song = deps.songs.get(d.songId)
      return song ? { item, missing: false, title: song.title } : removed
    }
    case 'media': {
      const m = deps.media.get(d.mediaId)
      return m ? { item, missing: false, title: m.originalName } : removed
    }
    case 'bible':
      return { item, missing: false, title: d.ref }
    case 'youtube':
    case 'notice':
      return { item, missing: false, title: d.title }
  }
}
