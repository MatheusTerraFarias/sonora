import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { openDatabase } from '../../../src/main/db/database'

function tmpFile(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'sonora-')), name)
}

test('openDatabase cria todas as tabelas e é idempotente', () => {
  const file = tmpFile('sonora.db')
  openDatabase(file).close()
  const db = openDatabase(file) // segunda vez não reaplica
  const tables = (db.prepare("select name from sqlite_master where type='table'").all() as { name: string }[]).map(
    (r) => r.name
  )
  expect(tables).toEqual(
    expect.arrayContaining([
      'songs',
      'song_parts',
      'media',
      'services',
      'service_items',
      'youtube_favorites',
      'settings',
      'sound_maps',
      'service_sound',
      'schema_version'
    ])
  )
  expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
  expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
  const versions = db.prepare('select version from schema_version').all()
  expect(versions).toHaveLength(2)
  db.close()
})

test('apagar música remove as partes em cascata', () => {
  const db = openDatabase(tmpFile('c.db'))
  const now = new Date().toISOString()
  db.prepare("insert into songs(id,title,tags,arrangement,created_at,updated_at) values('s','T','[]','[]',?,?)").run(now, now)
  db.prepare("insert into song_parts(id,song_id,label,slides,position) values('p','s','V1','[]',0)").run()
  db.prepare("delete from songs where id='s'").run()
  expect(db.prepare('select count(*) c from song_parts').get()).toEqual({ c: 0 })
  db.close()
})
