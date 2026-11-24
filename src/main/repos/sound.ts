import { randomUUID } from 'node:crypto'
import type { ID } from '../../shared/types'
import type { ChannelKind, ChecklistItem, ServiceSound, SoundChannel, SoundMap } from '../../shared/sound'
import type { Db } from '../db/database'

interface MapRow {
  id: string
  name: string
  channels: string
  checklist: string
  created_at: string
  updated_at: string
}

interface ServiceSoundRow {
  service_id: string
  map_id: string | null
  checked: string
  channel_notes: string
}

const KINDS: ChannelKind[] = ['wireless', 'wired', 'line', 'other']

/** JSON ilegível ou de formato inesperado vira o valor vazio, sem lançar */
const parseArray = (raw: string): unknown[] => {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const parseRecord = (raw: string): Record<string, string> => {
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {}
  } catch {
    return {}
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

const normInput = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)

const objects = (list: unknown[]): Record<string, unknown>[] =>
  list.filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')

const normChannels = (list: unknown[]): SoundChannel[] =>
  objects(list).map((c, i) => ({
    id: str(c.id) || randomUUID(),
    number: i + 1,
    name: str(c.name),
    person: str(c.person),
    kind: KINDS.includes(c.kind as ChannelKind) ? (c.kind as ChannelKind) : 'other',
    notes: str(c.notes),
    inputIndex: normInput(c.inputIndex)
  }))

const normChecklist = (list: unknown[]): ChecklistItem[] =>
  objects(list).map((c) => ({ id: str(c.id) || randomUUID(), text: str(c.text) }))

const toMap = (r: MapRow): SoundMap => ({
  id: r.id,
  name: r.name,
  channels: normChannels(parseArray(r.channels)),
  checklist: normChecklist(parseArray(r.checklist)),
  createdAt: r.created_at,
  updatedAt: r.updated_at
})

export function createSoundRepo(db: Db) {
  const get = (id: ID): SoundMap | null => {
    const row = db.prepare('SELECT * FROM sound_maps WHERE id = ?').get(id) as MapRow | undefined
    return row ? toMap(row) : null
  }

  const mustGet = (id: ID): SoundMap => {
    const m = get(id)
    if (!m) throw new Error(`Mapa de som não encontrado: ${id}`)
    return m
  }

  const insert = (name: string, channels: SoundChannel[], checklist: ChecklistItem[]): SoundMap => {
    const id = randomUUID()
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO sound_maps(id, name, channels, checklist, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, name, JSON.stringify(channels), JSON.stringify(checklist), now, now)
    return mustGet(id)
  }

  const getForService = (serviceId: ID): ServiceSound => {
    const row = db
      .prepare('SELECT service_id, map_id, checked, channel_notes FROM service_sound WHERE service_id = ?')
      .get(serviceId) as ServiceSoundRow | undefined
    if (!row) return { serviceId, mapId: null, checked: [], channelNotes: {} }
    return {
      serviceId,
      mapId: row.map_id,
      checked: parseArray(row.checked).filter((x): x is string => typeof x === 'string'),
      channelNotes: parseRecord(row.channel_notes)
    }
  }

  return {
    list(): SoundMap[] {
      return (db.prepare('SELECT * FROM sound_maps ORDER BY name COLLATE NOCASE, rowid').all() as MapRow[]).map(toMap)
    },

    get,

    create(name: string): SoundMap {
      return insert(name, [], [])
    },

    /** normaliza: números 1..n na ordem do array, inputIndex inteiro >= 0 ou null, ids novos onde faltam */
    save(map: SoundMap): SoundMap {
      mustGet(map.id)
      db.prepare('UPDATE sound_maps SET name = ?, channels = ?, checklist = ?, updated_at = ? WHERE id = ?').run(
        map.name,
        JSON.stringify(normChannels(map.channels)),
        JSON.stringify(normChecklist(map.checklist)),
        new Date().toISOString(),
        map.id
      )
      return mustGet(map.id)
    },

    duplicate(id: ID, name: string): SoundMap {
      const src = mustGet(id)
      return insert(
        name,
        src.channels.map((c) => ({ ...c, id: randomUUID() })),
        src.checklist.map((c) => ({ ...c, id: randomUUID() }))
      )
    },

    remove(id: ID): void {
      db.prepare('DELETE FROM sound_maps WHERE id = ?').run(id)
    },

    getForService,

    setForService(serviceId: ID, patch: Partial<Omit<ServiceSound, 'serviceId'>>): ServiceSound {
      const next = { ...getForService(serviceId), ...patch }
      db.prepare(
        `INSERT INTO service_sound(service_id, map_id, checked, channel_notes, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(service_id) DO UPDATE SET map_id = excluded.map_id, checked = excluded.checked,
           channel_notes = excluded.channel_notes, updated_at = excluded.updated_at`
      ).run(serviceId, next.mapId, JSON.stringify(next.checked), JSON.stringify(next.channelNotes), new Date().toISOString())
      return getForService(serviceId)
    }
  }
}

export type SoundRepo = ReturnType<typeof createSoundRepo>
