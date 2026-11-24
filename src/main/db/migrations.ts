export interface Migration {
  version: number
  sql: string
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
CREATE TABLE songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  song_key TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  arrangement TEXT NOT NULL DEFAULT '[]',
  attachment TEXT,
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE song_parts (
  id TEXT PRIMARY KEY,
  song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  slides TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_song_parts_song ON song_parts(song_id, position);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE service_items (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL,
  ref_id TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_service_items_service ON service_items(service_id, position);

CREATE TABLE youtube_favorites (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT '',
  thumbnail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`
  },
  {
    version: 2,
    sql: `
CREATE TABLE sound_maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channels TEXT NOT NULL DEFAULT '[]',
  checklist TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE service_sound (
  service_id TEXT PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  map_id TEXT REFERENCES sound_maps(id) ON DELETE SET NULL,
  checked TEXT NOT NULL DEFAULT '[]',
  channel_notes TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
`
  }
]
